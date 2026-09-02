import { countCheckboxes, countOrderedItems, extractSection, findHeadings } from './markdown.js'
import { stripFrontmatter } from './references.js'
import { parseStoryStatus } from './status.js'
import type { ChecklistProgress, StoryStatus } from './types.js'

export interface ParsedStory {
  /** Heading title with any `Story 41.3:` prefix removed. */
  title: string | null
  /** The full first heading, kept for the generated page. */
  heading: string | null
  /** Status declared inside the story file, when present. */
  declaredStatus: StoryStatus | null
  acceptanceCriteria: ChecklistProgress | null
  tasks: ChecklistProgress | null
  frontmatter: string
  body: string
}

const AC_HEADING = /^acceptance\s+criteri(?:a|on)\b/i
const TASKS_HEADING = /^tasks?\b/i
const STORY_TITLE_PREFIX = /^story\s+\d+[.-]\d+[a-z]?\s*[:—–-]\s*/i

function progress(
  checkboxes: { total: number; completed: number },
  orderedCount: number
): ChecklistProgress | null {
  if (checkboxes.total > 0) {
    return { total: checkboxes.total, completed: checkboxes.completed, checkable: true }
  }
  if (orderedCount > 0) {
    return { total: orderedCount, completed: 0, checkable: false }
  }
  return null
}

/**
 * Reads the parts of a BMAD story file the dashboard needs. The file itself is
 * never rewritten — this only measures it.
 */
export function parseStory(markdown: string): ParsedStory {
  const { frontmatter, body } = stripFrontmatter(markdown)
  const headings = findHeadings(body)
  const first = headings[0]
  const heading = first ? first.text : null
  const title = heading === null ? null : heading.replace(STORY_TITLE_PREFIX, '').trim() || heading

  const statusMatch = /^[ \t]*(?:\*\*)?status(?:\*\*)?[ \t]*:[ \t]*(.+?)[ \t]*$/im.exec(body)
  const declaredStatus = statusMatch ? parseStoryStatus(statusMatch[1]?.replace(/[`*]/g, '')) : null

  const acSection = extractSection(body, (candidate) => AC_HEADING.test(candidate.text))
  const tasksSection = extractSection(body, (candidate) => TASKS_HEADING.test(candidate.text))

  return {
    title,
    heading,
    declaredStatus,
    acceptanceCriteria: acSection
      ? progress(countCheckboxes(acSection.body), countOrderedItems(acSection.body))
      : null,
    tasks: tasksSection ? progress(countCheckboxes(tasksSection.body), 0) : null,
    frontmatter,
    body
  }
}

/** `41-3-search-candidates` -> `Search Candidates`, used when the file is missing. */
export function titleFromStoryKey(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => (word.length <= 2 ? word : (word[0] as string).toUpperCase() + word.slice(1)))
    .join(' ')
}
