import { parseDocument, isMap, isScalar, type Document } from 'yaml'
import type { ContextTone, DashboardWarning } from './types.js'
import { slugify, uniqueSlug } from '../shared/text.js'
import { classifyKey, type ClassifiedKey } from './status.js'

/** A `development_status` entry, in file order. */
export interface SprintStatusEntry {
  key: string
  rawStatus: string
  classification: ClassifiedKey
}

export type CommentBlockKind = 'context' | 'definitions' | 'metadata'

export interface SprintStatusComment {
  id: string
  title: string
  /** Comment prefixes removed, ASCII rules dropped, indentation preserved. */
  body: string
  kind: CommentBlockKind
  tone: ContextTone
}

export interface ParsedSprintStatus {
  project?: string
  projectKey?: string
  trackingSystem?: string
  generated?: string
  lastUpdated?: string
  scope?: string
  storyLocation?: string
  planningSource?: string
  entries: SprintStatusEntry[]
  comments: SprintStatusComment[]
  warnings: DashboardWarning[]
}

export class SprintStatusError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SprintStatusError'
  }
}

const METADATA_KEYS = [
  'generated',
  'last_updated',
  'project',
  'project_key',
  'tracking_system',
  'story_location',
  'planning_source',
  'scope',
  'sprint',
  'epic'
] as const

/**
 * Titles that BMAD ships in every sprint-status file. They explain the tool,
 * not the sprint, and must never surface as a product-level notice.
 */
const GENERIC_TITLES = [
  /^status\s+definitions?\b/i,
  /^workflow\s+notes?\b/i,
  /^definitions?\b/i,
  /^legend\b/i,
  /^conventions?\b/i,
  /^how\s+to\s+use\b/i,
  /^(epic|story|retrospective)\s+status\b/i,
  /^notes?\s+on\s+status\b/i
]

/** `- backlog: Story is specified but ...` — the shape of a definitions list. */
const DEFINITION_LINE =
  /^[-*\s]*(backlog|ready-for-dev|ready_for_dev|in-progress|in_progress|review|done|optional|drafted|approved|blocked)\s*:/i

const PAUSED_SIGNALS =
  /(\bpaused\b|\bpause\b|\bon hold\b|\bhalted\b|\bsuspended\b|\bfrozen\b|\ben pause\b|\bsuspendu|\bgel[ée]|⏸|⏯)/i
const BLOCKED_SIGNALS = /(\bblocked\b|\bblocker\b|\bblocking\b|\bbloqu[ée]|\bblocage\b|🚫|⛔)/i
/** `====`, `----`, `****` — ASCII rules that would become Markdown headings. */
const RULE_LINE = /^[\s]*[=\-*_~#]{3,}[\s]*$/

interface CommentRegionLine {
  /** Comment text with the `#` and at most one following space removed. */
  text: string
}

/** Groups consecutive `#` lines, stopping at the first line of real YAML. */
function collectCommentRegions(text: string): CommentRegionLine[][] {
  const regions: CommentRegionLine[][] = []
  let current: CommentRegionLine[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const commentMatch = /^[ \t]*#(.*)$/.exec(rawLine)
    if (commentMatch) {
      const body = commentMatch[1] ?? ''
      current.push({ text: body.startsWith(' ') ? body.slice(1) : body })
      continue
    }
    if (current.length > 0) {
      regions.push(current)
      current = []
    }
  }
  if (current.length > 0) regions.push(current)
  return regions
}

/**
 * A banner is a line underlined by an ASCII rule — the BMAD house style. The
 * same rule usually closes the banner further down, and that closing rule must
 * not turn the last line of the block into a second heading, so an underline
 * identical to the one already open is treated as the closer.
 */
function headingUnderline(
  lines: CommentRegionLine[],
  index: number,
  openUnderline: string | null
): string | null {
  const line = lines[index]?.text.trim() ?? ''
  if (line === '' || RULE_LINE.test(line)) return null
  const next = lines[index + 1]?.text.trim() ?? ''
  if (!RULE_LINE.test(next)) return null
  if (openUnderline !== null && next === openUnderline) return null
  return next
}

function unwrapBody(lines: CommentRegionLine[]): string {
  const kept = lines.filter((line) => !RULE_LINE.test(line.text.trim()))
  while (kept.length > 0 && kept[0]!.text.trim() === '') kept.shift()
  while (kept.length > 0 && kept[kept.length - 1]!.text.trim() === '') kept.pop()
  return kept.map((line) => line.text.replace(/\s+$/, '')).join('\n')
}

function looksLikeMetadata(lines: CommentRegionLine[]): boolean {
  const meaningful = lines.filter((line) => line.text.trim() !== '')
  if (meaningful.length === 0) return false
  return meaningful.every((line) => {
    const trimmed = line.text.trim()
    // Continuation lines of a wrapped value are indented, not `key: value`.
    if (/^\s/.test(line.text) && !/^[a-z_]+\s*:/i.test(trimmed)) return true
    const match = /^([a-z_]+)\s*:/i.exec(trimmed)
    return match !== null && (METADATA_KEYS as readonly string[]).includes(match[1]!.toLowerCase())
  })
}

function looksLikeDefinitions(title: string, body: string): boolean {
  if (GENERIC_TITLES.some((pattern) => pattern.test(title.trim()))) return true
  const lines = body.split('\n').filter((line) => line.trim() !== '')
  if (lines.length < 3) return false
  const definitionLines = lines.filter((line) => DEFINITION_LINE.test(line)).length
  return definitionLines / lines.length >= 0.5
}

function detectTone(title: string, body: string): ContextTone {
  const haystack = `${title}\n${body}`
  if (PAUSED_SIGNALS.test(haystack)) return 'paused'
  if (BLOCKED_SIGNALS.test(haystack)) return 'blocked'
  return 'note'
}

/**
 * Splits comment regions into titled blocks and classifies each one. A YAML
 * parser drops comments entirely, so this reads the raw text in parallel.
 */
export function extractCommentBlocks(text: string): SprintStatusComment[] {
  const blocks: SprintStatusComment[] = []
  const usedIds = new Set<string>()

  for (const region of collectCommentRegions(text)) {
    const segments: { titleIndex: number | null; lines: CommentRegionLine[] }[] = []
    let currentLines: CommentRegionLine[] = []
    let currentTitle: number | null = null
    let openUnderline: string | null = null

    for (let index = 0; index < region.length; index += 1) {
      const underline = headingUnderline(region, index, openUnderline)
      if (underline !== null) {
        if (currentLines.length > 0) segments.push({ titleIndex: currentTitle, lines: currentLines })
        currentLines = [region[index] as CommentRegionLine]
        currentTitle = 0
        openUnderline = underline
        continue
      }
      currentLines.push(region[index] as CommentRegionLine)
    }
    if (currentLines.length > 0) segments.push({ titleIndex: currentTitle, lines: currentLines })

    for (const segment of segments) {
      const banner = segment.titleIndex !== null
      const bannerTitle = banner ? (segment.lines[0]?.text.trim() ?? '') : ''
      const text_ = unwrapBody(banner ? segment.lines.slice(1) : segment.lines)
      if (bannerTitle === '' && text_ === '') continue

      // Without a banner, a short opening line still reads as a title; a long
      // one is a sentence and belongs in the body.
      const firstLine = text_.split('\n')[0] ?? ''
      const impliedTitle = !banner && firstLine.length > 0 && firstLine.length <= 72 ? firstLine : ''
      const title = banner ? bannerTitle : impliedTitle !== '' ? impliedTitle : 'Sprint note'
      const body = banner || impliedTitle === '' ? text_ : text_.split('\n').slice(1).join('\n').trimStart()

      const kind: CommentBlockKind = looksLikeMetadata(segment.lines)
        ? 'metadata'
        : looksLikeDefinitions(title, body)
          ? 'definitions'
          : 'context'

      const id = uniqueSlug(slugify(title), usedIds)

      blocks.push({
        id,
        title,
        body,
        kind,
        tone: kind === 'context' ? detectTone(title, body) : 'note'
      })
    }
  }

  return blocks
}

/** Coerces a YAML scalar to text without ever stringifying an object. */
function scalarText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  return ''
}

function readScalar(doc: Document.Parsed, key: string): string | undefined {
  return scalarText(doc.get(key)).trim() || undefined
}

/**
 * Parses the sprint status file. Structured data comes from the YAML document;
 * comments come from the raw text. Both halves are needed: the YAML is the
 * source of truth for scope, and the comments carry the human context.
 */
export function parseSprintStatus(text: string, path: string): ParsedSprintStatus {
  // Duplicate keys are reported as a warning below rather than failing the
  // build: a repeated entry should not take a whole sprint portal down.
  const doc = parseDocument(text, { keepSourceTokens: false, uniqueKeys: false })
  const fatal = doc.errors[0]
  if (fatal) {
    throw new SprintStatusError(
      `${path} is not valid YAML: ${fatal.message.split('\n')[0] ?? fatal.message}`
    )
  }

  const warnings: DashboardWarning[] = []
  const comments = extractCommentBlocks(text)

  /** Metadata sometimes lives only in the commented header of the file. */
  const commentMetadata = new Map<string, string>()
  for (const block of comments) {
    if (block.kind !== 'metadata') continue
    for (const line of `${block.title}\n${block.body}`.split('\n')) {
      const match = /^([a-z_]+)\s*:\s*(.+)$/i.exec(line.trim())
      if (!match) continue
      const key = match[1]!.toLowerCase()
      if (!(METADATA_KEYS as readonly string[]).includes(key)) continue
      if (!commentMetadata.has(key)) commentMetadata.set(key, match[2]!.trim())
    }
  }

  const meta = (key: string): string | undefined =>
    readScalar(doc, key) ?? commentMetadata.get(key)

  const developmentStatus = doc.get('development_status')
  if (developmentStatus === undefined || developmentStatus === null) {
    throw new SprintStatusError(
      `${path} has no \`development_status\` block; it cannot define a sprint scope.`
    )
  }
  if (!isMap(developmentStatus)) {
    throw new SprintStatusError(
      `${path} has a \`development_status\` that is not a mapping of keys to statuses.`
    )
  }

  const entries: SprintStatusEntry[] = []
  const seenKeys = new Set<string>()
  for (const item of developmentStatus.items) {
    const key = scalarText(isScalar(item.key) ? item.key.value : undefined).trim()
    if (key === '') continue
    if (seenKeys.has(key)) {
      warnings.push({
        code: 'duplicate-status-key',
        message: `\`${key}\` appears more than once in development_status; the first occurrence wins.`,
        severity: 'warning',
        path
      })
      continue
    }
    seenKeys.add(key)

    // A nested mapping or sequence is not a status; it stays empty and is
    // reported as unrecognised below.
    const rawStatus = isScalar(item.value) ? scalarText(item.value.value).trim() : ''

    const classification = classifyKey(key)
    if (classification.kind === 'unknown') {
      warnings.push({
        code: 'unknown-status-key',
        message: `\`${key}\` in development_status is neither an epic, a story nor a retrospective key; it is not displayed.`,
        severity: 'warning',
        path
      })
    }
    entries.push({ key, rawStatus, classification })
  }

  if (entries.length === 0) {
    throw new SprintStatusError(`${path} has an empty \`development_status\`; there is nothing to display.`)
  }

  const storyLocation = meta('story_location')
  const planningSource = meta('planning_source')
  if (storyLocation === undefined) {
    warnings.push({
      code: 'missing-story-location',
      message:
        'No `story_location` in the sprint status: story Markdown files cannot be located, so stories are listed without content.',
      severity: 'warning',
      path
    })
  }
  if (planningSource === undefined) {
    warnings.push({
      code: 'missing-planning-source',
      message: 'No `planning_source` in the sprint status: epic pages are generated without planning content.',
      severity: 'warning',
      path
    })
  }

  return {
    project: meta('project'),
    projectKey: meta('project_key'),
    trackingSystem: meta('tracking_system'),
    generated: meta('generated'),
    lastUpdated: meta('last_updated'),
    scope: meta('scope'),
    storyLocation,
    planningSource,
    entries,
    comments,
    warnings
  }
}

/** `.../sprint-6/sprint-status.yaml` -> `Sprint 6`. */
export function deduceSprintLabel(...candidates: (string | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    if (!candidate) continue
    const match = /sprint[\s_-]*([0-9]+(?:\.[0-9]+)?[a-z]?)/i.exec(candidate)
    if (match) return `Sprint ${match[1]}`
  }
  return undefined
}
