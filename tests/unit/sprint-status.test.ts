import { describe, expect, it } from 'vitest'
import {
  deduceSprintLabel,
  extractCommentBlocks,
  parseSprintStatus,
  SprintStatusError
} from '../../src/bmad/sprint-status'

const PATH = '_bmad-output/implementation-artifacts/sprint-6/sprint-status.yaml'

const FILE = `# generated: 2026-08-20T17:23:42+02:00
# project: DemoProject
# story_location: _bmad-output/implementation-artifacts/sprint-6
# planning_source: _bmad-output/planning-artifacts/epics-sprint-6.md
#
# WORK IS PAUSED — 2026-08-27
# =====================================
# Epics 41 and 42 are on hold pending a vendor answer.
#
# Full context:
# \`_bmad-output/implementation-artifacts/sprint-6/pause-2026-08-27.md\`
# =====================================

# STATUS DEFINITIONS:
# ==================
# Story Status:
#   - backlog: Story is specified but a prerequisite remains open
#   - ready-for-dev: Scope and acceptance criteria are determined
#   - in-progress: Developer actively working
#   - review: Implementation complete
#   - done: Story completed

# WORKFLOW NOTES:
# ===============
# - A detailed story file does not make a story ready-for-dev.
# - Do not merge this file into the historical sprint-status.yaml.

generated: 2026-08-20T17:23:42+02:00
last_updated: 2026-09-01T16:30:00+02:00
project: DemoProject
story_location: _bmad-output/implementation-artifacts/sprint-6
planning_source: _bmad-output/planning-artifacts/epics-sprint-6.md
scope: isolated Sprint 6 preparatory backlog

development_status:
  epic-41: in-progress
  41-1-first-story: done
  41-2-second-story: review
  epic-41-retrospective: optional

  epic-42: backlog
  42-1-third-story: backlog
`

describe('parseSprintStatus', () => {
  const parsed = parseSprintStatus(FILE, PATH)

  it('reads the metadata that defines the sprint', () => {
    expect(parsed.project).toBe('DemoProject')
    expect(parsed.storyLocation).toBe('_bmad-output/implementation-artifacts/sprint-6')
    expect(parsed.planningSource).toBe('_bmad-output/planning-artifacts/epics-sprint-6.md')
    expect(parsed.scope).toBe('isolated Sprint 6 preparatory backlog')
    expect(parsed.lastUpdated).toBe('2026-09-01T16:30:00+02:00')
  })

  it('preserves the order of development_status', () => {
    expect(parsed.entries.map((entry) => entry.key)).toEqual([
      'epic-41',
      '41-1-first-story',
      '41-2-second-story',
      'epic-41-retrospective',
      'epic-42',
      '42-1-third-story'
    ])
  })

  it('classifies each key', () => {
    expect(parsed.entries.map((entry) => entry.classification.kind)).toEqual([
      'epic',
      'story',
      'story',
      'retrospective',
      'epic',
      'story'
    ])
  })

  it('keeps sprint context and drops generic BMAD definitions', () => {
    const context = parsed.comments.filter((comment) => comment.kind === 'context')
    expect(context).toHaveLength(1)
    expect(context[0]?.title).toBe('WORK IS PAUSED — 2026-08-27')
    expect(context[0]?.tone).toBe('paused')
    expect(context[0]?.body).toContain('on hold pending a vendor answer')

    const definitions = parsed.comments.filter((comment) => comment.kind === 'definitions')
    expect(definitions.map((comment) => comment.title)).toEqual([
      'STATUS DEFINITIONS:',
      'WORKFLOW NOTES:'
    ])
  })

  it('does not split a banner at its closing rule', () => {
    const context = parsed.comments.filter((comment) => comment.kind === 'context')
    expect(context[0]?.body).toContain('pause-2026-08-27.md')
  })

  it('reads the header comments as metadata, not as sprint context', () => {
    const metadata = parsed.comments.filter((comment) => comment.kind === 'metadata')
    expect(metadata.length).toBeGreaterThan(0)
  })

  it('reports no warnings for a well-formed file', () => {
    expect(parsed.warnings).toEqual([])
  })
})

describe('parseSprintStatus failures', () => {
  it('throws on invalid YAML', () => {
    expect(() => parseSprintStatus('a:\n  - b\n c: [', PATH)).toThrow(SprintStatusError)
  })

  it('throws when there is no development_status', () => {
    expect(() => parseSprintStatus('project: X\n', PATH)).toThrow(/development_status/)
  })

  it('throws when development_status is empty', () => {
    expect(() => parseSprintStatus('development_status: {}\n', PATH)).toThrow(/nothing to display/)
  })

  it('throws when development_status is not a mapping', () => {
    expect(() => parseSprintStatus('development_status:\n  - a\n', PATH)).toThrow(/not a mapping/)
  })

  it('warns about an unrecognised key rather than dropping it silently', () => {
    const parsed = parseSprintStatus('development_status:\n  random-note: done\n', PATH)
    expect(parsed.warnings.map((warning) => warning.code)).toContain('unknown-status-key')
  })

  it('warns about a duplicate key', () => {
    const parsed = parseSprintStatus(
      'development_status:\n  epic-1: done\n  "epic-1": backlog\n',
      PATH
    )
    expect(parsed.warnings.map((warning) => warning.code)).toContain('duplicate-status-key')
  })

  it('warns when story_location or planning_source is missing', () => {
    const parsed = parseSprintStatus('development_status:\n  epic-1: done\n', PATH)
    const codes = parsed.warnings.map((warning) => warning.code)
    expect(codes).toContain('missing-story-location')
    expect(codes).toContain('missing-planning-source')
  })

  it('falls back to the commented header when the YAML lacks metadata', () => {
    const parsed = parseSprintStatus(
      '# project: FromComment\n# story_location: docs/sprint-3\n\ndevelopment_status:\n  epic-1: done\n',
      PATH
    )
    expect(parsed.project).toBe('FromComment')
    expect(parsed.storyLocation).toBe('docs/sprint-3')
  })
})

describe('extractCommentBlocks', () => {
  it('treats a definitions-shaped list without a known title as generic', () => {
    const blocks = extractCommentBlocks(
      [
        '# Legende interne',
        '# ================',
        '#   - backlog: pas commence',
        '#   - review: pret a relire',
        '#   - done: termine',
        '',
        'development_status: {}'
      ].join('\n')
    )
    expect(blocks[0]?.kind).toBe('definitions')
  })

  it('detects a blocked tone', () => {
    const blocks = extractCommentBlocks(
      ['# SUPPLIER BLOCKED', '# ================', '# The provider has not answered.'].join('\n')
    )
    expect(blocks[0]?.tone).toBe('blocked')
  })

  it('uses a generic title when an untitled note opens with a long sentence', () => {
    const long = 'a'.repeat(90)
    const blocks = extractCommentBlocks(`# ${long}\n# more\n`)
    expect(blocks[0]?.title).toBe('Sprint note')
    expect(blocks[0]?.body).toContain(long)
  })
})

describe('deduceSprintLabel', () => {
  it('reads the sprint from a path, then from the scope', () => {
    expect(deduceSprintLabel('_bmad-output/implementation-artifacts/sprint-6')).toBe('Sprint 6')
    expect(deduceSprintLabel(undefined, undefined, 'isolated Sprint 12 backlog')).toBe('Sprint 12')
    expect(deduceSprintLabel(undefined, 'docs/status.yaml')).toBeUndefined()
  })
})
