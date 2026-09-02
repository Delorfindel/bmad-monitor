import type { AppConfig } from '../config/env.js'
import { collectEpicTitles, extractEpicSection, type EpicPlanningSection } from '../bmad/planning.js'
import {
  extractDocumentReferences,
  extractImageReferences,
  sprintSearchDirs,
  stripFrontmatter,
  titleFromMarkdown,
  titleFromPath,
  type DocumentReferenceCandidate
} from '../bmad/references.js'
import { deduceSprintLabel, parseSprintStatus, type ParsedSprintStatus } from '../bmad/sprint-status.js'
import {
  deriveEpicStatus,
  parseEpicStatus,
  parseRetrospectiveStatus,
  parseStoryStatus,
  storyLabel
} from '../bmad/status.js'
import { parseStory, titleFromStoryKey, type ParsedStory } from '../bmad/story.js'
import {
  emptyStatusCounts,
  type DashboardWarning,
  type DocumentReference,
  type SprintContextBlock,
  type SprintDashboardData,
  type SprintEpic,
  type SprintRetrospective,
  type SprintStory,
  type StatusCounts
} from '../bmad/types.js'
import type { ContentSource } from '../github/types.js'
import { mapWithConcurrency } from '../shared/concurrency.js'
import { silentLogger, type Logger } from '../shared/logger.js'
import { joinRepoPath, normalizeRepoPath } from '../shared/paths.js'
import { slugify, uniqueSlug } from '../shared/text.js'
import { contextRoute, epicRoute, storyRoute } from './routes.js'

export interface StoryDocument {
  story: SprintStory
  /** Source Markdown with front matter removed, or `null` when missing. */
  markdown: string | null
  parsed: ParsedStory | null
}

export interface EpicDocument {
  epic: SprintEpic
  planning: EpicPlanningSection | null
}

export interface LinkedDocument {
  path: string
  slug: string
  title: string
  route: string
  markdown: string
  externalUrl?: string
}

export interface CollectedSprint {
  data: SprintDashboardData
  stories: StoryDocument[]
  epics: EpicDocument[]
  linkedDocuments: LinkedDocument[]
  /** Repository path -> bytes, for assets referenced by included documents. */
  assets: Map<string, Uint8Array>
  /** Repository path -> raw text, mirrored into `.generated/raw` for auditing. */
  rawTexts: Map<string, string>
}

export interface CollectOptions {
  logger?: Logger
}

/** Caches every read so a path probed by two documents costs one request. */
function createProbe(source: ContentSource): {
  text: (path: string) => Promise<string | null>
  bytes: (path: string) => Promise<Uint8Array | null>
  texts: Map<string, string>
} {
  const textCache = new Map<string, Promise<string | null>>()
  const byteCache = new Map<string, Promise<Uint8Array | null>>()
  const texts = new Map<string, string>()
  return {
    text(path) {
      const cached = textCache.get(path)
      if (cached) return cached
      const pending = source.readText(path).then((value) => {
        if (value !== null) texts.set(path, value)
        return value
      })
      textCache.set(path, pending)
      return pending
    },
    bytes(path) {
      const cached = byteCache.get(path)
      if (cached) return cached
      const pending = source.read(path)
      byteCache.set(path, pending)
      return pending
    },
    texts
  }
}

function countByStatus(stories: readonly SprintStory[]): StatusCounts {
  const counts = emptyStatusCounts()
  for (const story of stories) counts[story.status] += 1
  return counts
}

function addCounts(target: StatusCounts, source: StatusCounts): void {
  for (const key of Object.keys(target) as (keyof StatusCounts)[]) target[key] += source[key]
}

/**
 * Reads the configured sprint status and everything it points at, then builds
 * the typed model the site is generated from. Nothing outside that scope is
 * fetched: the sprint status is the only authority on what belongs here.
 */
export async function collectSprint(
  config: AppConfig,
  source: ContentSource,
  options: CollectOptions = {}
): Promise<CollectedSprint> {
  const logger = options.logger ?? silentLogger
  const warnings: DashboardWarning[] = []
  const probe = createProbe(source)

  const sprintStatusText = await probe.text(config.sprintStatusPath)
  if (sprintStatusText === null) {
    throw new Error(
      `Sprint status not found: ${config.sprintStatusPath} does not exist in ${source.revision.repository} at ${source.revision.ref}. Check BMAD_SPRINT_STATUS.`
    )
  }

  const parsed = parseSprintStatus(sprintStatusText, config.sprintStatusPath)
  warnings.push(...parsed.warnings)
  logger.info(`Sprint status parsed: ${parsed.entries.length} entries.`)

  const storyLocation = safePath(parsed.storyLocation, 'story_location', config.sprintStatusPath, warnings)
  const planningSource = safePath(parsed.planningSource, 'planning_source', config.sprintStatusPath, warnings)

  const { epics, stories, retrospectives } = buildSkeleton(parsed, config.sprintStatusPath, warnings)

  // --- Story files -------------------------------------------------------
  const storyDocuments = await mapWithConcurrency(stories, config.concurrency, (story) =>
    loadStory(story, storyLocation, source, probe, warnings)
  )

  // --- Planning source ---------------------------------------------------
  let planningMarkdown: string | null = null
  if (planningSource !== null) {
    planningMarkdown = await probe.text(planningSource)
    if (planningMarkdown === null) {
      warnings.push({
        code: 'missing-planning-file',
        message: `\`planning_source\` points at ${planningSource}, which was not found at this revision. Epic pages fall back to their story list.`,
        severity: 'warning',
        path: planningSource
      })
    }
  }

  const planningTitles = planningMarkdown
    ? collectEpicTitles(planningMarkdown)
    : new Map<number, string>()
  const epicDocuments: EpicDocument[] = epics.map((epic) => {
    const section = planningMarkdown ? extractEpicSection(planningMarkdown, epic.number) : null
    const title = section?.title ?? planningTitles.get(epic.number)
    if (title) epic.title = title
    if (planningMarkdown !== null && section === null) {
      epic.planningMissing = true
      warnings.push({
        code: 'missing-epic-section',
        message: `No section for Epic ${epic.number} was found in ${planningSource}. Its page lists the sprint stories only.`,
        severity: 'warning',
        path: planningSource ?? undefined
      })
    }
    if (planningSource !== null) {
      epic.planningSource = planningSource
      epic.planningExternalUrl = source.fileUrl(planningSource)
    }
    return { epic, planning: section }
  })

  // --- Referenced documents ----------------------------------------------
  const searchDirs = sprintSearchDirs(storyLocation, planningSource)
  const contextComments = parsed.comments.filter((comment) => comment.kind === 'context')
  const groupSources: { owner: string; groups: DocumentReferenceCandidate[] }[] = [
    ...contextComments.map((comment) => ({
      owner: `context:${comment.id}`,
      groups: extractDocumentReferences(
        `${comment.title}\n${comment.body}`,
        config.sprintStatusPath,
        searchDirs
      )
    })),
    // The whole sprint status, comments and YAML values alike: BMAD records
    // paths in structured blocks too, and those are as much a part of the
    // sprint's context as the banner above them.
    {
      owner: 'sprint-status',
      groups: extractDocumentReferences(sprintStatusText, config.sprintStatusPath, searchDirs)
    },
    ...(planningMarkdown !== null && planningSource !== null
      ? [
          {
            owner: 'planning',
            groups: extractDocumentReferences(planningMarkdown, planningSource, searchDirs)
          }
        ]
      : []),
    ...storyDocuments
      .filter((document) => document.markdown !== null && document.story.sourcePath !== undefined)
      .map((document) => ({
        owner: `story:${document.story.key}`,
        groups: extractDocumentReferences(
          document.markdown as string,
          document.story.sourcePath as string,
          searchDirs
        )
      }))
  ]

  const uniqueGroups = new Map<string, DocumentReferenceCandidate>()
  for (const entry of groupSources) {
    for (const group of entry.groups) {
      const identity = group.candidates.join('|')
      if (!uniqueGroups.has(identity)) uniqueGroups.set(identity, group)
    }
  }

  const resolutions = new Map<string, string | null>()
  const resolvedList = await mapWithConcurrency(
    [...uniqueGroups.entries()],
    config.concurrency,
    async ([identity, group]) => {
      for (const candidate of group.candidates) {
        if ((await probe.text(candidate)) !== null) return [identity, candidate] as const
      }
      return [identity, null] as const
    }
  )
  for (const [identity, resolved] of resolvedList) resolutions.set(identity, resolved)

  const brokenReferences: DocumentReferenceCandidate[] = []
  const orderedResolved: string[] = []
  const seenResolved = new Set<string>()
  for (const [identity, group] of uniqueGroups) {
    const resolved = resolutions.get(identity) ?? null
    if (resolved === null) {
      brokenReferences.push(group)
      warnings.push({
        code: 'broken-reference',
        message: `\`${group.raw}\` is referenced by the sprint but no such file exists at this revision.`,
        severity: 'warning',
        path: group.raw
      })
      continue
    }
    if (seenResolved.has(resolved)) continue
    seenResolved.add(resolved)
    orderedResolved.push(resolved)
  }

  const notPublishable = new Set<string>([config.sprintStatusPath])
  if (planningSource !== null) notPublishable.add(planningSource)
  for (const document of storyDocuments) {
    if (document.story.sourcePath) notPublishable.add(document.story.sourcePath)
  }

  const publishable = orderedResolved.filter((path) => !notPublishable.has(path))
  if (publishable.length > config.maxLinkedDocuments) {
    warnings.push({
      code: 'linked-documents-truncated',
      message: `${publishable.length} linked documents were referenced; only the first ${config.maxLinkedDocuments} are published (BMAD_MAX_LINKED_DOCUMENTS).`,
      severity: 'warning'
    })
  }

  const usedSlugs = new Set<string>()
  const linkedDocuments: LinkedDocument[] = []
  for (const documentPath of publishable.slice(0, config.maxLinkedDocuments)) {
    const text = (await probe.text(documentPath)) as string
    const basename = (documentPath.split('/').pop() ?? documentPath).replace(/\.md$/i, '')
    const slug = uniqueSlug(slugify(basename), usedSlugs)
    linkedDocuments.push({
      path: documentPath,
      slug,
      title: titleFromMarkdown(text) ?? titleFromPath(documentPath),
      route: contextRoute(slug),
      markdown: stripFrontmatter(text).body,
      externalUrl: source.fileUrl(documentPath)
    })
  }

  const routeByPath = new Map<string, string>()
  for (const document of linkedDocuments) routeByPath.set(document.path, document.route)
  for (const document of storyDocuments) {
    if (document.story.sourcePath) routeByPath.set(document.story.sourcePath, document.story.route)
  }

  // --- Assets ------------------------------------------------------------
  const includedDocuments = [
    ...storyDocuments
      .filter((document) => document.markdown !== null && document.story.sourcePath !== undefined)
      .map((document) => ({
        path: document.story.sourcePath as string,
        markdown: document.markdown as string
      })),
    ...(planningMarkdown !== null && planningSource !== null
      ? [{ path: planningSource, markdown: planningMarkdown }]
      : []),
    ...linkedDocuments.map((document) => ({ path: document.path, markdown: document.markdown }))
  ]
  const assets = await loadAssets({ config, probe, warnings, documents: includedDocuments })

  // --- References on the model -------------------------------------------
  const titleByPath = new Map(linkedDocuments.map((document) => [document.path, document.title]))
  const referenceOf = (path: string): DocumentReference => ({
    path,
    title: titleByPath.get(path) ?? titleFromPath(path),
    route: routeByPath.get(path),
    externalUrl: source.fileUrl(path),
    available: true
  })
  const brokenReferenceOf = (group: DocumentReferenceCandidate): DocumentReference => ({
    path: group.raw,
    title: titleFromPath(group.raw),
    available: false
  })

  const referencesFor = (groups: DocumentReferenceCandidate[]): DocumentReference[] => {
    const out: DocumentReference[] = []
    const seen = new Set<string>()
    for (const group of groups) {
      const resolved = resolutions.get(group.candidates.join('|')) ?? null
      if (resolved === null) {
        if (seen.has(group.raw)) continue
        seen.add(group.raw)
        out.push(brokenReferenceOf(group))
        continue
      }
      if (!routeByPath.has(resolved) || seen.has(resolved)) continue
      seen.add(resolved)
      out.push(referenceOf(resolved))
    }
    return out
  }

  const groupsByOwner = new Map(groupSources.map((entry) => [entry.owner, entry.groups]))
  for (const document of storyDocuments) {
    document.story.references = referencesFor(groupsByOwner.get(`story:${document.story.key}`) ?? [])
  }

  const contextBlocks: SprintContextBlock[] = contextComments.map((comment) => ({
    id: comment.id,
    title: comment.title,
    body: comment.body,
    tone: comment.tone,
    references: referencesFor(groupsByOwner.get(`context:${comment.id}`) ?? [])
  }))

  const progress = emptyStatusCounts()
  for (const epic of epics) {
    addCounts(progress, epic.progress)
    epic.retrospective = retrospectives.get(epic.number)
  }

  const data: SprintDashboardData = {
    project: parsed.project ?? source.revision.repository,
    sprintLabel: deduceSprintLabel(storyLocation ?? undefined, config.sprintStatusPath, parsed.scope),
    scope: parsed.scope,
    generated: parsed.generated,
    lastUpdated: parsed.lastUpdated,
    snapshot: { ...source.revision, generatedAt: new Date().toISOString() },
    sprintStatusPath: config.sprintStatusPath,
    sprintStatusUrl: source.fileUrl(config.sprintStatusPath),
    storyLocation: storyLocation ?? undefined,
    planningSource: planningSource ?? undefined,
    planningSourceUrl: planningSource !== null ? source.fileUrl(planningSource) : undefined,
    epics,
    progress,
    totalStories: stories.length,
    contextBlocks,
    references: linkedDocuments.map((document) => referenceOf(document.path)),
    warnings
  }

  const rawTexts = new Map<string, string>()
  for (const path of [
    config.sprintStatusPath,
    ...(planningSource !== null ? [planningSource] : []),
    ...storyDocuments.flatMap((document) => (document.story.sourcePath ? [document.story.sourcePath] : [])),
    ...linkedDocuments.map((document) => document.path)
  ]) {
    const text = probe.texts.get(path)
    if (text !== undefined) rawTexts.set(path, text)
  }

  return { data, stories: storyDocuments, epics: epicDocuments, linkedDocuments, assets, rawTexts }
}

function safePath(
  value: string | undefined,
  field: string,
  sprintStatusPath: string,
  warnings: DashboardWarning[]
): string | null {
  if (value === undefined) return null
  const normalized = normalizeRepoPath(value)
  if (normalized === null) {
    warnings.push({
      code: `invalid-${field.replace('_', '-')}`,
      message: `\`${field}\` (${value}) is not a safe repository-relative path and was ignored.`,
      severity: 'warning',
      path: sprintStatusPath
    })
  }
  return normalized
}

interface Skeleton {
  epics: SprintEpic[]
  stories: SprintStory[]
  retrospectives: Map<number, SprintRetrospective>
}

/**
 * Walks `development_status` once, in file order, so the sprint's own ordering
 * of epics and stories is what the site shows.
 */
export function buildSkeleton(
  parsed: ParsedSprintStatus,
  sprintStatusPath: string,
  warnings: DashboardWarning[]
): Skeleton {
  const epicsByNumber = new Map<number, SprintEpic>()
  const epics: SprintEpic[] = []
  const stories: SprintStory[] = []
  const retrospectives = new Map<number, SprintRetrospective>()
  const declaredEpicStatus = new Map<number, string>()

  const ensureEpic = (number: number): SprintEpic => {
    const existing = epicsByNumber.get(number)
    if (existing) return existing
    const epic: SprintEpic = {
      number,
      title: `Epic ${number}`,
      status: 'backlog',
      rawStatus: '',
      stories: [],
      progress: emptyStatusCounts(),
      completion: 0,
      route: epicRoute(number),
      planningMissing: false
    }
    epicsByNumber.set(number, epic)
    epics.push(epic)
    return epic
  }

  for (const entry of parsed.entries) {
    const { classification } = entry

    if (classification.kind === 'epic') {
      const epic = ensureEpic(classification.epicNumber)
      epic.rawStatus = entry.rawStatus
      declaredEpicStatus.set(classification.epicNumber, entry.rawStatus)
      const status = parseEpicStatus(entry.rawStatus)
      if (status === null) {
        warnings.push({
          code: 'unknown-epic-status',
          message: `Epic ${classification.epicNumber} has status \`${entry.rawStatus}\`, which is not a known epic status; it was derived from its stories instead.`,
          severity: 'warning',
          path: sprintStatusPath
        })
      } else {
        epic.status = status
      }
      continue
    }

    if (classification.kind === 'retrospective') {
      const status = parseRetrospectiveStatus(entry.rawStatus)
      if (status === null) {
        warnings.push({
          code: 'unknown-retrospective-status',
          message: `\`${entry.key}\` has status \`${entry.rawStatus}\`, which is not a known retrospective status.`,
          severity: 'warning',
          path: sprintStatusPath
        })
      }
      retrospectives.set(classification.epicNumber, {
        key: entry.key,
        epicNumber: classification.epicNumber,
        status: status ?? 'optional',
        rawStatus: entry.rawStatus
      })
      continue
    }

    if (classification.kind !== 'story') continue

    const status = parseStoryStatus(entry.rawStatus)
    if (status === null) {
      warnings.push({
        code: 'unknown-story-status',
        message: `Story ${entry.key} has status \`${entry.rawStatus}\`, which is not a known story status; it is shown as backlog.`,
        severity: 'warning',
        path: sprintStatusPath
      })
    }

    const epic = ensureEpic(classification.epicNumber)
    const story: SprintStory = {
      key: entry.key,
      epicNumber: classification.epicNumber,
      storyNumber: classification.storyNumber,
      label: storyLabel(classification.epicNumber, classification.storyNumber),
      title: titleFromStoryKey(classification.slug),
      status: status ?? 'backlog',
      rawStatus: entry.rawStatus,
      route: storyRoute(entry.key),
      references: [],
      missingSource: true
    }
    epic.stories.push(story)
    stories.push(story)
  }

  for (const epic of epics) {
    epic.progress = countByStatus(epic.stories)
    epic.completion = epic.stories.length === 0 ? 0 : epic.progress.done / epic.stories.length
    if (parseEpicStatus(declaredEpicStatus.get(epic.number) ?? '') === null) {
      epic.status = deriveEpicStatus(epic.stories)
    }
  }

  return { epics, stories, retrospectives }
}

async function loadStory(
  story: SprintStory,
  storyLocation: string | null,
  source: ContentSource,
  probe: { text: (path: string) => Promise<string | null> },
  warnings: DashboardWarning[]
): Promise<StoryDocument> {
  if (storyLocation === null) return { story, markdown: null, parsed: null }

  const candidates = [
    joinRepoPath(storyLocation, `${story.key}.md`),
    joinRepoPath(storyLocation, `story-${story.key}.md`)
  ].filter((path): path is string => path !== null)

  for (const path of candidates) {
    const text = await probe.text(path)
    if (text === null) continue
    const parsed = parseStory(text)
    story.sourcePath = path
    story.externalUrl = source.fileUrl(path)
    story.missingSource = false
    if (parsed.title) story.title = parsed.title
    if (parsed.acceptanceCriteria) story.acceptanceCriteria = parsed.acceptanceCriteria
    if (parsed.tasks) story.tasks = parsed.tasks
    if (parsed.declaredStatus !== null && parsed.declaredStatus !== story.status) {
      warnings.push({
        code: 'status-mismatch',
        message: `Story ${story.label} is \`${story.status}\` in the sprint status but declares \`${parsed.declaredStatus}\` in its own file. The sprint status wins.`,
        severity: 'info',
        path
      })
    }
    return { story, markdown: parsed.body, parsed }
  }

  warnings.push({
    code: 'missing-story-file',
    message: `No Markdown file was found for story ${story.label} (looked for ${candidates[0]}).`,
    severity: 'warning',
    path: candidates[0]
  })
  return { story, markdown: null, parsed: null }
}

async function loadAssets(input: {
  config: AppConfig
  probe: { bytes: (path: string) => Promise<Uint8Array | null> }
  warnings: DashboardWarning[]
  documents: { path: string; markdown: string }[]
}): Promise<Map<string, Uint8Array>> {
  const groups: DocumentReferenceCandidate[] = []
  const seen = new Set<string>()
  for (const document of input.documents) {
    for (const group of extractImageReferences(document.markdown, document.path)) {
      const identity = group.candidates.join('|')
      if (seen.has(identity)) continue
      seen.add(identity)
      groups.push(group)
    }
  }

  const selected = groups.slice(0, input.config.maxAssets)
  if (groups.length > selected.length) {
    input.warnings.push({
      code: 'assets-truncated',
      message: `${groups.length} images were referenced; only the first ${selected.length} are published (BMAD_MAX_ASSETS).`,
      severity: 'warning'
    })
  }

  const assets = new Map<string, Uint8Array>()
  const results = await mapWithConcurrency(selected, input.config.concurrency, async (group) => {
    for (const candidate of group.candidates) {
      const bytes = await input.probe.bytes(candidate)
      if (bytes !== null) return { group, path: candidate, bytes }
    }
    return { group, path: null, bytes: null }
  })

  for (const result of results) {
    if (result.bytes === null || result.path === null) {
      input.warnings.push({
        code: 'missing-asset',
        message: `Image \`${result.group.raw}\` is referenced by an included document but was not found at this revision.`,
        severity: 'warning',
        path: result.group.raw
      })
      continue
    }
    if (result.bytes.byteLength > input.config.maxAssetBytes) {
      input.warnings.push({
        code: 'asset-too-large',
        message: `Image ${result.path} exceeds BMAD_MAX_ASSET_BYTES and was not published.`,
        severity: 'warning',
        path: result.path
      })
      continue
    }
    assets.set(result.path, result.bytes)
  }
  return assets
}
