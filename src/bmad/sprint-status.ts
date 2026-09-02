import { parseDocument, isMap, isScalar, type Document } from 'yaml'
import type { DashboardWarning } from './types.js'
import { classifyKey, type ClassifiedKey } from './status.js'

/** A `development_status` entry, in file order. */
export interface SprintStatusEntry {
  key: string
  rawStatus: string
  classification: ClassifiedKey
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
  warnings: DashboardWarning[]
}

export class SprintStatusError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SprintStatusError'
  }
}

/**
 * The attributes BMAD defines. Nothing outside this list is interpreted: a
 * sprint status may carry any amount of free-form prose and project-specific
 * blocks, and none of it means anything to this tool.
 */
const KNOWN_ATTRIBUTES = [
  'generated',
  'last_updated',
  'project',
  'project_key',
  'tracking_system',
  'story_location',
  'planning_source',
  'scope'
] as const

/** `# story_location: docs/sprint-6` — an attribute written in the header. */
const COMMENTED_ATTRIBUTE = /^[ \t]*#[ \t]*([a-z_]+)[ \t]*:[ \t]*(.+?)[ \t]*$/

/**
 * Reads the known attributes from the commented header some sprint statuses
 * carry above the YAML. Only these keys are looked for, and only the first
 * occurrence of each counts; everything else in the comments is ignored.
 */
function readCommentedAttributes(text: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const match = COMMENTED_ATTRIBUTE.exec(line)
    if (!match) continue
    const key = match[1] as string
    if (!(KNOWN_ATTRIBUTES as readonly string[]).includes(key)) continue
    if (!found.has(key)) found.set(key, match[2] as string)
  }
  return found
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
 * Parses the sprint status: the YAML attributes BMAD defines, and the ordered
 * `development_status` block that alone decides what belongs to the sprint.
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
  const commented = readCommentedAttributes(text)
  const attribute = (key: string): string | undefined => readScalar(doc, key) ?? commented.get(key)

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
    throw new SprintStatusError(
      `${path} has an empty \`development_status\`; there is nothing to display.`
    )
  }

  const storyLocation = attribute('story_location')
  const planningSource = attribute('planning_source')
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
      message:
        'No `planning_source` in the sprint status: epic pages are generated without planning content.',
      severity: 'warning',
      path
    })
  }

  return {
    project: attribute('project'),
    projectKey: attribute('project_key'),
    trackingSystem: attribute('tracking_system'),
    generated: attribute('generated'),
    lastUpdated: attribute('last_updated'),
    scope: attribute('scope'),
    storyLocation,
    planningSource,
    entries,
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
