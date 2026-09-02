import { useData } from 'vitepress'
import { computed, type ComputedRef } from 'vue'
import type { SprintDashboardData, SprintEpic, SprintStory } from '../../../src/bmad/types'
import type { SequenceEntry } from '../../../src/generation/navigation'
import type { BmadThemeConfig } from '../theme-config'

export interface SprintPageContext {
  sprint: ComputedRef<SprintDashboardData>
  sequence: ComputedRef<SequenceEntry[]>
  /** Set on a generated story page. */
  story: ComputedRef<SprintStory | null>
  /** Set on a story page (its epic) or on an epic page. */
  epic: ComputedRef<SprintEpic | null>
  previous: ComputedRef<SequenceEntry | null>
  next: ComputedRef<SequenceEntry | null>
  kind: ComputedRef<string | null>
}

/**
 * The single point where components read the generated model. Nothing parses
 * BMAD here: the pipeline did that at build time.
 */
export function useSprint(): SprintPageContext {
  const { theme, frontmatter, page } = useData<BmadThemeConfig>()

  const sprint = computed(() => theme.value.sprint)
  const sequence = computed(() => theme.value.sequence ?? [])
  const kind = computed<string | null>(() => (frontmatter.value.bmadType as string) ?? null)
  const key = computed<string | null>(() => (frontmatter.value.bmadKey as string) ?? null)

  const story = computed<SprintStory | null>(() => {
    if (kind.value !== 'story' || key.value === null) return null
    for (const epic of sprint.value.epics) {
      const found = epic.stories.find((candidate) => candidate.key === key.value)
      if (found) return found
    }
    return null
  })

  const epic = computed<SprintEpic | null>(() => {
    if (kind.value === 'epic' && key.value !== null) {
      return sprint.value.epics.find((candidate) => String(candidate.number) === key.value) ?? null
    }
    if (story.value) {
      return sprint.value.epics.find((candidate) => candidate.number === story.value?.epicNumber) ?? null
    }
    return null
  })

  const currentRoute = computed(() => {
    if (story.value) return story.value.route
    if (kind.value === 'epic' && epic.value) return epic.value.route
    return page.value.relativePath
  })

  const index = computed(() =>
    sequence.value.findIndex((entry) => entry.route === currentRoute.value)
  )
  const previous = computed(() =>
    index.value > 0 ? (sequence.value[index.value - 1] ?? null) : null
  )
  const next = computed(() =>
    index.value >= 0 && index.value < sequence.value.length - 1
      ? (sequence.value[index.value + 1] ?? null)
      : null
  )

  return { sprint, sequence, story, epic, previous, next, kind }
}
