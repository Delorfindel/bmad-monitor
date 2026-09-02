import { describe, expect, it } from 'vitest'
import { buildNavigation } from '../../src/generation/navigation'
import { emptyStatusCounts, type SprintDashboardData } from '../../src/bmad/types'

function story(key: string, label: string, title: string, status: 'done' | 'review' | 'backlog') {
  return {
    key,
    epicNumber: 2,
    storyNumber: label.split('.')[1] as string,
    label,
    title,
    status,
    rawStatus: status,
    route: `/stories/${key}`,
    references: [],
    missingSource: false
  }
}

const data: SprintDashboardData = {
  project: 'Demo',
  sprintLabel: 'Sprint 9',
  snapshot: {
    repository: 'acme/atlas',
    ref: 'main',
    commitSha: 'a'.repeat(40),
    shortSha: 'aaaaaaa',
    local: false,
    generatedAt: '2026-01-01T00:00:00Z'
  },
  sprintStatusPath: 'sprint/sprint-status.yaml',
  epics: [
    {
      number: 2,
      title: 'Provider <Integration> & "quotes"',
      status: 'in-progress',
      rawStatus: 'in-progress',
      stories: [
        story('2-1-alpha', '2.1', 'Alpha', 'done'),
        story('2-2-beta', '2.2', 'Beta <script>', 'review')
      ],
      progress: emptyStatusCounts(),
      completion: 0.5,
      route: '/epics/2',
      planningMissing: false
    },
    {
      number: 3,
      title: 'Later',
      status: 'backlog',
      rawStatus: 'backlog',
      stories: [],
      progress: emptyStatusCounts(),
      completion: 0,
      route: '/epics/3',
      planningMissing: false
    }
  ],
  progress: emptyStatusCounts(),
  totalStories: 2,
  contextBlocks: [],
  references: [
    { path: 'docs/blocked.md', title: 'Blocked', route: '/context/blocked', available: true }
  ],
  warnings: []
}

describe('buildNavigation', () => {
  const navigation = buildNavigation(data)

  it('lists the dashboard, then the epics in sprint order', () => {
    expect(navigation.sidebar[0]?.items?.[0]).toEqual({ text: 'Dashboard', link: '/' })
    expect(navigation.sidebar[1]?.link).toBe('/epics/2')
    expect(navigation.sidebar[2]?.link).toBe('/epics/3')
  })

  it('carries a status word for every entry, not just a colour', () => {
    expect(navigation.sidebar[1]?.text).toContain('In progress')
    expect(navigation.sidebar[1]?.items?.[0]?.text).toContain('Done')
    expect(navigation.sidebar[1]?.items?.[1]?.text).toContain('In review')
  })

  it('escapes titles, because the sidebar label is rendered as HTML', () => {
    expect(navigation.sidebar[1]?.text).toContain('Provider &lt;Integration&gt; &amp; &quot;quotes&quot;')
    expect(navigation.sidebar[1]?.text).not.toContain('<script>')
    expect(navigation.sidebar[1]?.items?.[1]?.text).toContain('&lt;script&gt;')
  })

  it('opens the epic being worked on and collapses the others', () => {
    expect(navigation.sidebar[1]?.collapsed).toBe(false)
    expect(navigation.sidebar[2]?.collapsed).toBe(true)
  })

  it('adds linked documents at the end, collapsed', () => {
    const last = navigation.sidebar.at(-1)
    expect(last?.text).toBe('Linked documents')
    expect(last?.collapsed).toBe(true)
    expect(last?.items?.[0]?.link).toBe('/context/blocked')
  })

  it('produces a reading sequence following the sprint order', () => {
    expect(navigation.sequence.map((entry) => entry.route)).toEqual([
      '/epics/2',
      '/stories/2-1-alpha',
      '/stories/2-2-beta',
      '/epics/3'
    ])
  })
})
