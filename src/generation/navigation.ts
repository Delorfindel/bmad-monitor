import { EPIC_STATUS_LABELS, STATUS_LABELS, type SprintDashboardData } from '../bmad/types.js'
import { escapeHtml } from '../shared/text.js'

/**
 * VitePress renders sidebar labels with `v-html`, which is what lets a status
 * travel with every entry. Everything interpolated here is escaped first, and
 * the status is always carried by a word — never by the colour alone.
 */
export interface ThemeSidebarItem {
  text: string
  link?: string
  items?: ThemeSidebarItem[]
  collapsed?: boolean
}

export interface SequenceEntry {
  route: string
  /** `12.3` for a story, `Epic 12` for an epic. */
  label: string
  title: string
  kind: 'epic' | 'story'
}

export interface ThemeNavigation {
  sidebar: ThemeSidebarItem[]
  /** Reading order for the previous/next links, taken from the sprint status. */
  sequence: SequenceEntry[]
}

function navLabel(title: string, status: string, statusLabel: string, id?: string): string {
  const idHtml = id === undefined ? '' : `<span class="bm-nav-id">${escapeHtml(id)}</span>`
  return (
    `<span class="bm-nav">` +
    `<span class="bm-nav-title">${idHtml}${escapeHtml(title)}</span>` +
    `<span class="bm-nav-status" data-status="${escapeHtml(status)}">` +
    `<i class="bm-nav-dot" aria-hidden="true"></i>${escapeHtml(statusLabel)}</span>` +
    `</span>`
  )
}

export function buildNavigation(data: SprintDashboardData): ThemeNavigation {
  const sidebar: ThemeSidebarItem[] = [
    {
      text: escapeHtml(data.sprintLabel ?? 'Sprint'),
      items: [{ text: 'Dashboard', link: '/' }]
    }
  ]
  const sequence: SequenceEntry[] = []

  for (const epic of data.epics) {
    sequence.push({
      route: epic.route,
      label: `Epic ${epic.number}`,
      title: epic.title,
      kind: 'epic'
    })
    const items: ThemeSidebarItem[] = epic.stories.map((story) => {
      sequence.push({ route: story.route, label: story.label, title: story.title, kind: 'story' })
      return {
        text: navLabel(story.title, story.status, STATUS_LABELS[story.status], story.label),
        link: story.route
      }
    })

    sidebar.push({
      text: navLabel(epic.title, epic.status, EPIC_STATUS_LABELS[epic.status], `Epic ${epic.number}`),
      link: epic.route,
      // An epic being worked on is the one a reader opened the site for.
      collapsed: epic.status !== 'in-progress',
      items
    })
  }

  const linked = data.references.filter((reference) => reference.route !== undefined)
  if (linked.length > 0) {
    sidebar.push({
      text: 'Linked documents',
      collapsed: true,
      items: linked.map((reference) => ({
        text: escapeHtml(reference.title),
        link: reference.route as string
      }))
    })
  }

  return { sidebar, sequence }
}
