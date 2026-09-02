import {
  EPIC_STATUSES,
  RETROSPECTIVE_STATUSES,
  STORY_STATUSES,
  type EpicStatus,
  type RetrospectiveStatus,
  type StoryStatus
} from './types.js'

/** `epic-41` */
export const EPIC_KEY_PATTERN = /^epic-(\d+)$/
/** `epic-41-retrospective` */
export const RETROSPECTIVE_KEY_PATTERN = /^epic-(\d+)-retrospective$/
/** `41-3-search-soundcharts-candidates` — the story number may carry a suffix. */
export const STORY_KEY_PATTERN = /^(\d+)-(\d+[a-z]?)-(.+)$/

export type DevelopmentStatusKind = 'epic' | 'story' | 'retrospective' | 'unknown'

export type ClassifiedKey =
  | { kind: 'epic'; key: string; epicNumber: number }
  | { kind: 'retrospective'; key: string; epicNumber: number }
  | { kind: 'story'; key: string; epicNumber: number; storyNumber: string; slug: string }
  | { kind: 'unknown'; key: string }

/**
 * Retrospective keys also match the epic prefix, so they are tested first.
 */
export function classifyKey(key: string): ClassifiedKey {
  const retro = RETROSPECTIVE_KEY_PATTERN.exec(key)
  if (retro) {
    return { kind: 'retrospective', key, epicNumber: Number(retro[1]) }
  }
  const epic = EPIC_KEY_PATTERN.exec(key)
  if (epic) {
    return { kind: 'epic', key, epicNumber: Number(epic[1]) }
  }
  const story = STORY_KEY_PATTERN.exec(key)
  if (story) {
    return {
      kind: 'story',
      key,
      epicNumber: Number(story[1]),
      storyNumber: story[2] as string,
      slug: story[3] as string
    }
  }
  return { kind: 'unknown', key }
}

/** `41-3-...` -> `41.3`, the identifier used everywhere in the UI. */
export function storyLabel(epicNumber: number, storyNumber: string): string {
  return `${epicNumber}.${storyNumber}`
}

function normalizeToken(value: unknown): string {
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : ''
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
}

export function parseStoryStatus(value: unknown): StoryStatus | null {
  const token = normalizeToken(value)
  return (STORY_STATUSES as readonly string[]).includes(token)
    ? (token as StoryStatus)
    : null
}

export function parseEpicStatus(value: unknown): EpicStatus | null {
  const token = normalizeToken(value)
  return (EPIC_STATUSES as readonly string[]).includes(token) ? (token as EpicStatus) : null
}

export function parseRetrospectiveStatus(value: unknown): RetrospectiveStatus | null {
  const token = normalizeToken(value)
  return (RETROSPECTIVE_STATUSES as readonly string[]).includes(token)
    ? (token as RetrospectiveStatus)
    : null
}

/** Derives an epic status from its stories when the YAML value is unusable. */
export function deriveEpicStatus(stories: readonly { status: StoryStatus }[]): EpicStatus {
  if (stories.length === 0) return 'backlog'
  if (stories.every((story) => story.status === 'done')) return 'done'
  if (stories.every((story) => story.status === 'backlog')) return 'backlog'
  return 'in-progress'
}
