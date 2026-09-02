import { describe, expect, it } from 'vitest'
import { collectEpicTitles, extractEpicSection } from '../../src/bmad/planning'

const PLANNING = `# Sprint 6 Breakdown

## Epic List

### Epic 41: Trusted Preparation

One line only.

### Epic 42: Safe Import

Another line.

## Epic 41: Trusted Preparation

**Goal.** The real section.

### Scope

- One thing.

### Dependencies and Risks

- A risk.

## Epic 42: Safe Import

The other real section.

## Assumptions
`

describe('extractEpicSection', () => {
  it('picks the richest section when an epic is named twice', () => {
    const section = extractEpicSection(PLANNING, 41)
    expect(section?.title).toBe('Trusted Preparation')
    expect(section?.body).toContain('The real section')
    expect(section?.body).not.toContain('One line only')
  })

  it('stops at the next epic', () => {
    expect(extractEpicSection(PLANNING, 41)?.body).not.toContain('The other real section')
  })

  it('normalises inner headings so the page keeps a single h1', () => {
    const body = extractEpicSection(PLANNING, 41)?.body ?? ''
    expect(body).toContain('## Scope')
    expect(body).toContain('## Dependencies and Risks')
  })

  it('returns null when the epic has no section', () => {
    expect(extractEpicSection(PLANNING, 99)).toBeNull()
  })

  it('ignores an epic heading inside a fenced block', () => {
    const doc = '```\n## Epic 7: Fake\n```\n\n## Epic 8: Real\n\nbody\n'
    expect(extractEpicSection(doc, 7)).toBeNull()
    expect(extractEpicSection(doc, 8)?.title).toBe('Real')
  })

  it('tolerates a zero-padded epic number', () => {
    expect(extractEpicSection('## Epic 07: Padded\n\nbody\n', 7)?.title).toBe('Padded')
  })
})

describe('collectEpicTitles', () => {
  it('keeps the longest title found for each epic', () => {
    const titles = collectEpicTitles(PLANNING)
    expect(titles.get(41)).toBe('Trusted Preparation')
    expect(titles.get(42)).toBe('Safe Import')
  })
})
