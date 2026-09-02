/** BMAD status vocabulary and the model the site is generated from. */

export const EPIC_STATUSES = ['backlog', 'in-progress', 'done'] as const
export type EpicStatus = (typeof EPIC_STATUSES)[number]

export const STORY_STATUSES = [
  'backlog',
  'ready-for-dev',
  'in-progress',
  'review',
  'done'
] as const
export type StoryStatus = (typeof STORY_STATUSES)[number]

export const RETROSPECTIVE_STATUSES = ['optional', 'done'] as const
export type RetrospectiveStatus = (typeof RETROSPECTIVE_STATUSES)[number]

/** Counts per story status, in display order. Always present, zeros included. */
export type StatusCounts = Record<StoryStatus, number>

export type WarningSeverity = 'info' | 'warning'

export interface DashboardWarning {
  code: string
  message: string
  severity: WarningSeverity
  /** Repository-relative path the warning is about, when there is one. */
  path?: string
}

export interface DocumentReference {
  /** Repository-relative POSIX path. */
  path: string
  title: string
  /** Site route when the document was included in the build. */
  route?: string
  /** Link to the file on GitHub, when the source can build one. */
  externalUrl?: string
  /** `false` when the file could not be downloaded. */
  available: boolean
}

export interface ChecklistProgress {
  total: number
  completed: number
  /** `true` when the items are checkboxes, so `completed` is meaningful. */
  checkable: boolean
}

export interface SprintStory {
  key: string
  epicNumber: number
  /** `3` or `3a` — the part after the epic number. */
  storyNumber: string
  /** `41.3` — what people say out loud. */
  label: string
  title: string
  status: StoryStatus
  /** Raw value from the YAML, kept when it is not a known status. */
  rawStatus: string
  sourcePath?: string
  route: string
  externalUrl?: string
  acceptanceCriteria?: ChecklistProgress
  tasks?: ChecklistProgress
  references: DocumentReference[]
  /** `true` when no Markdown file was found for the story. */
  missingSource: boolean
}

export interface SprintRetrospective {
  key: string
  epicNumber: number
  status: RetrospectiveStatus
  rawStatus: string
}

export interface SprintEpic {
  number: number
  title: string
  status: EpicStatus
  rawStatus: string
  stories: SprintStory[]
  progress: StatusCounts
  /** Ratio of `done` stories, 0..1. */
  completion: number
  route: string
  planningSource?: string
  planningExternalUrl?: string
  /** `true` when no section for this epic was found in the planning source. */
  planningMissing: boolean
  retrospective?: SprintRetrospective
}

export type ContextTone = 'paused' | 'blocked' | 'note'

export interface SprintContextBlock {
  id: string
  title: string
  /** Markdown body, already unwrapped from the YAML comment prefixes. */
  body: string
  tone: ContextTone
  references: DocumentReference[]
}

export interface SprintSnapshot {
  repository: string
  ref: string
  commitSha: string
  shortSha: string
  /** `true` for fixture builds, where there is no commit to point at. */
  local: boolean
  commitUrl?: string
  generatedAt: string
}

export interface SprintDashboardData {
  project: string
  /** `Sprint 6` when it can be deduced, otherwise absent. */
  sprintLabel?: string
  scope?: string
  generated?: string
  lastUpdated?: string
  snapshot: SprintSnapshot
  sprintStatusPath: string
  sprintStatusUrl?: string
  storyLocation?: string
  planningSource?: string
  planningSourceUrl?: string
  epics: SprintEpic[]
  progress: StatusCounts
  totalStories: number
  contextBlocks: SprintContextBlock[]
  references: DocumentReference[]
  warnings: DashboardWarning[]
}

export const STATUS_LABELS: Record<StoryStatus, string> = {
  done: 'Done',
  review: 'In review',
  'in-progress': 'In progress',
  'ready-for-dev': 'Ready for dev',
  backlog: 'Backlog'
}

export const EPIC_STATUS_LABELS: Record<EpicStatus, string> = {
  done: 'Done',
  'in-progress': 'In progress',
  backlog: 'Backlog'
}

/** Display order for the segmented progress bar and every count list. */
export const STATUS_DISPLAY_ORDER: readonly StoryStatus[] = [
  'done',
  'review',
  'in-progress',
  'ready-for-dev',
  'backlog'
]

export function emptyStatusCounts(): StatusCounts {
  return {
    backlog: 0,
    'ready-for-dev': 0,
    'in-progress': 0,
    review: 0,
    done: 0
  }
}
