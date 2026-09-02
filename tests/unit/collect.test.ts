import { describe, expect, it } from 'vitest'
import { collectSprint } from '../../src/generation/collect'
import { FakeContentSource } from '../helpers/source'
import { testConfig } from '../helpers/config'

const STATUS_PATH = 'sprint/sprint-status.yaml'

const STATUS = `# PROVIDER BLOCKED — 2026-04-01
# ==========================
# Epic 2 waits on the provider. See \`docs/blocked.md\`.
# ==========================

# STATUS DEFINITIONS:
# ==================
# Story Status:
#   - backlog: not started
#   - done: finished

project: Demo
story_location: sprint/stories
planning_source: docs/epics.md
scope: isolated sprint 9

development_status:
  epic-2: in-progress
  2-1-alpha: done
  2-2-beta: review
  2-3-gamma: backlog
  epic-2-retrospective: optional
  epic-3: backlog
  3-1-delta: ready-for-dev
`

const FILES: Record<string, string> = {
  [STATUS_PATH]: STATUS,
  'docs/epics.md': [
    '# Plan',
    '',
    '## Epic 2: Provider Integration',
    '',
    'Goal text. See `docs/blocked.md`.',
    '',
    '## Epic 3: Later Work',
    '',
    'Other goal.',
    ''
  ].join('\n'),
  'docs/blocked.md': '# Blocked\n\nWaiting on the provider.\n',
  'sprint/stories/2-1-alpha.md': [
    '# Story 2.1: Alpha Contract',
    '',
    'Status: done',
    '',
    '## Acceptance Criteria',
    '',
    '1. First.',
    '2. Second.',
    '',
    '## Tasks / Subtasks',
    '',
    '- [x] 1. Do it',
    '- [ ] 2. Prove it',
    ''
  ].join('\n'),
  'sprint/stories/2-2-beta.md': '# Story 2.2: Beta\n\nStatus: in-progress\n',
  'sprint/stories/3-1-delta.md': '# Story 3.1: Delta\n\nSee `docs/blocked.md`.\n'
}

const config = testConfig({ sprintStatusPath: STATUS_PATH })

async function collect(files: Record<string, string | Uint8Array> = FILES) {
  const source = new FakeContentSource(files)
  return { source, result: await collectSprint(config, source) }
}

describe('collectSprint', () => {
  it('publishes every story of the sprint, whatever its status', async () => {
    const { result } = await collect()
    const keys = result.data.epics.flatMap((epic) => epic.stories.map((story) => story.key))
    expect(keys).toEqual(['2-1-alpha', '2-2-beta', '2-3-gamma', '3-1-delta'])
    expect(result.data.totalStories).toBe(4)
  })

  it('preserves the order of the sprint status file', async () => {
    const { result } = await collect()
    expect(result.data.epics.map((epic) => epic.number)).toEqual([2, 3])
  })

  it('computes progress per epic and for the sprint', async () => {
    const { result } = await collect()
    expect(result.data.epics[0]?.progress).toEqual({
      backlog: 1,
      'ready-for-dev': 0,
      'in-progress': 0,
      review: 1,
      done: 1
    })
    expect(result.data.progress).toEqual({
      backlog: 1,
      'ready-for-dev': 1,
      'in-progress': 0,
      review: 1,
      done: 1
    })
    expect(result.data.epics[0]?.completion).toBeCloseTo(1 / 3)
  })

  it('resolves story files under story_location', async () => {
    const { result } = await collect()
    const alpha = result.data.epics[0]?.stories[0]
    expect(alpha?.sourcePath).toBe('sprint/stories/2-1-alpha.md')
    expect(alpha?.title).toBe('Alpha Contract')
    expect(alpha?.acceptanceCriteria).toEqual({ total: 2, completed: 0, checkable: false })
    expect(alpha?.tasks).toEqual({ total: 2, completed: 1, checkable: true })
  })

  it('warns about a story with no Markdown file and marks it in the model', async () => {
    const { result } = await collect()
    const gamma = result.data.epics[0]?.stories[2]
    expect(gamma?.missingSource).toBe(true)
    expect(result.data.warnings.map((warning) => warning.code)).toContain('missing-story-file')
  })

  it('keeps the sprint status as the authority when a story file disagrees', async () => {
    const { result } = await collect()
    expect(result.data.epics[0]?.stories[1]?.status).toBe('review')
    expect(result.data.warnings.map((warning) => warning.code)).toContain('status-mismatch')
  })

  it('reads epic titles from planning_source', async () => {
    const { result } = await collect()
    expect(result.data.epics.map((epic) => epic.title)).toEqual([
      'Provider Integration',
      'Later Work'
    ])
    expect(result.epics[0]?.planning?.body).toContain('Goal text')
  })

  it('publishes documents referenced from comments, planning and stories', async () => {
    const { result } = await collect()
    expect(result.linkedDocuments.map((document) => document.path)).toEqual(['docs/blocked.md'])
    expect(result.data.references[0]?.route).toBe('/context/blocked')
  })

  it('surfaces sprint context and hides generic BMAD definitions', async () => {
    const { result } = await collect()
    expect(result.data.contextBlocks).toHaveLength(1)
    expect(result.data.contextBlocks[0]?.tone).toBe('blocked')
    expect(result.data.contextBlocks[0]?.references[0]?.route).toBe('/context/blocked')
  })

  it('records the snapshot without ever exposing a credential', async () => {
    const { result } = await collect()
    expect(result.data.snapshot.commitSha).toBe('a'.repeat(40))
    expect(JSON.stringify(result.data)).not.toMatch(/github_pat_|ghp_/)
  })
})

describe('collectSprint degraded inputs', () => {
  it('fails with an actionable message when the sprint status is missing', async () => {
    await expect(collect({})).rejects.toThrow(/BMAD_SPRINT_STATUS/)
  })

  it('warns and falls back when a status value is not recognised', async () => {
    const { result } = await collect({
      [STATUS_PATH]: 'development_status:\n  epic-1: paused\n  1-1-a: waiting\n'
    })
    const codes = result.data.warnings.map((warning) => warning.code)
    expect(codes).toContain('unknown-story-status')
    expect(codes).toContain('unknown-epic-status')
    expect(result.data.epics[0]?.stories[0]?.status).toBe('backlog')
    expect(result.data.epics[0]?.stories[0]?.rawStatus).toBe('waiting')
    // The epic status is derived from its stories rather than invented.
    expect(result.data.epics[0]?.status).toBe('backlog')
  })

  it('warns when planning_source cannot be read and keeps building', async () => {
    const { result } = await collect({ ...FILES, 'docs/epics.md': undefined as never })
    expect(result.data.warnings.map((warning) => warning.code)).toContain('missing-planning-file')
    expect(result.data.epics).toHaveLength(2)
  })

  it('warns when an epic has no planning section', async () => {
    const { result } = await collect({ ...FILES, 'docs/epics.md': '# Plan\n\n## Epic 2: Only\n\nx\n' })
    expect(result.data.warnings.map((warning) => warning.code)).toContain('missing-epic-section')
    expect(result.data.epics[1]?.planningMissing).toBe(true)
  })

  it('ignores a story_location that tries to escape the repository', async () => {
    const { result } = await collect({
      [STATUS_PATH]: 'story_location: ../../etc\ndevelopment_status:\n  epic-1: done\n  1-1-a: done\n'
    })
    expect(result.data.warnings.map((warning) => warning.code)).toContain('invalid-story-location')
    expect(result.data.storyLocation).toBeUndefined()
  })

  it('reports a reference that points at nothing', async () => {
    const { result } = await collect({
      ...FILES,
      'sprint/stories/3-1-delta.md': '# Story 3.1: Delta\n\nSee `docs/never-written.md`.\n'
    })
    const broken = result.data.warnings.filter((warning) => warning.code === 'broken-reference')
    expect(broken).toHaveLength(1)
    const delta = result.data.epics[1]?.stories[0]
    expect(delta?.references[0]).toMatchObject({ path: 'docs/never-written.md', available: false })
  })

  it('caps the number of published linked documents', async () => {
    const many: Record<string, string> = { ...FILES }
    const links: string[] = []
    for (let index = 0; index < 5; index += 1) {
      many[`docs/extra-${index}.md`] = `# Extra ${index}\n`
      links.push(`\`docs/extra-${index}.md\``)
    }
    many['sprint/stories/2-2-beta.md'] = `# Story 2.2: Beta\n\n${links.join('\n\n')}\n`
    const source = new FakeContentSource(many)
    const result = await collectSprint(
      testConfig({ sprintStatusPath: STATUS_PATH, maxLinkedDocuments: 2 }),
      source
    )
    expect(result.linkedDocuments).toHaveLength(2)
    expect(result.data.warnings.map((warning) => warning.code)).toContain(
      'linked-documents-truncated'
    )
  })

  it('downloads only the images referenced by included documents', async () => {
    const source = new FakeContentSource({
      ...FILES,
      'sprint/stories/2-2-beta.md': '# Story 2.2: Beta\n\n![shot](../../docs/shot.png)\n',
      'docs/shot.png': new Uint8Array([1, 2, 3]),
      'docs/unused.png': new Uint8Array([4, 5, 6])
    })
    const result = await collectSprint(config, source)
    expect([...result.assets.keys()]).toEqual(['docs/shot.png'])
  })

  it('warns when a referenced image cannot be found', async () => {
    const source = new FakeContentSource({
      ...FILES,
      'sprint/stories/2-2-beta.md': '# Story 2.2: Beta\n\n![shot](../../docs/gone.png)\n'
    })
    const result = await collectSprint(config, source)
    expect(result.data.warnings.map((warning) => warning.code)).toContain('missing-asset')
  })

  it('reads each file at most once even when several documents point at it', async () => {
    const { source } = await collect()
    const blockedReads = source.reads.filter((path) => path === 'docs/blocked.md')
    expect(blockedReads).toHaveLength(1)
  })
})
