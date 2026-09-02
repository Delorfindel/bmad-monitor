import { describe, expect, it } from 'vitest'
import { parseStory, titleFromStoryKey } from '../../src/bmad/story'

const STORY = `---
baseline_commit: abc123
---
# Story 41.3: Search Candidates Through a Bounded Contract

Status: review
Priority: P0

## Story

As an owner, I want a bounded search.

## Acceptance Criteria

1. **Given** a query, **when** search runs, **then** it is bounded.
2. **Given** an error, **when** it happens, **then** it is typed.
3. **Given** a homonym, **when** results return, **then** nothing is merged.

## Tasks / Subtasks

- [x] 1. Define schemas
  - [x] Model the query
  - [ ] Model the cursor
- [ ] 2. Run the smoke test

## Dev Notes

Nothing here.
`

describe('parseStory', () => {
  const parsed = parseStory(STORY)

  it('separates front matter from the body', () => {
    expect(parsed.frontmatter).toContain('baseline_commit')
    expect(parsed.body.startsWith('# Story 41.3')).toBe(true)
  })

  it('strips the "Story 41.3:" prefix from the title', () => {
    expect(parsed.title).toBe('Search Candidates Through a Bounded Contract')
    expect(parsed.heading).toBe('Story 41.3: Search Candidates Through a Bounded Contract')
  })

  it('reads the status declared in the file', () => {
    expect(parsed.declaredStatus).toBe('review')
  })

  it('counts numbered acceptance criteria without pretending they are checkable', () => {
    expect(parsed.acceptanceCriteria).toEqual({ total: 3, completed: 0, checkable: false })
  })

  it('counts tasks and subtasks, checked and unchecked', () => {
    expect(parsed.tasks).toEqual({ total: 4, completed: 2, checkable: true })
  })
})

describe('parseStory edge cases', () => {
  it('treats checkbox acceptance criteria as checkable', () => {
    const parsed = parseStory('# S\n\n## Acceptance Criteria\n\n- [x] one\n- [ ] two\n')
    expect(parsed.acceptanceCriteria).toEqual({ total: 2, completed: 1, checkable: true })
  })

  it('returns null sections when the story has none', () => {
    const parsed = parseStory('# Story 1.1: Bare\n\nJust prose.\n')
    expect(parsed.acceptanceCriteria).toBeNull()
    expect(parsed.tasks).toBeNull()
    expect(parsed.declaredStatus).toBeNull()
  })

  it('accepts a bold status line', () => {
    expect(parseStory('# S\n\n**Status**: ready-for-dev\n').declaredStatus).toBe('ready-for-dev')
  })

  it('ignores an unknown declared status instead of inventing one', () => {
    expect(parseStory('# S\n\nStatus: paused\n').declaredStatus).toBeNull()
  })

  it('does not count checkboxes that live in a fenced example', () => {
    const parsed = parseStory('# S\n\n## Tasks\n\n```\n- [x] sample\n```\n\n- [ ] real\n')
    expect(parsed.tasks).toEqual({ total: 1, completed: 0, checkable: true })
  })
})

describe('titleFromStoryKey', () => {
  it('builds a readable fallback title', () => {
    expect(titleFromStoryKey('search-soundcharts-candidates')).toBe('Search Soundcharts Candidates')
  })
})
