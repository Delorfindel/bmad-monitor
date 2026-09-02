import { describe, expect, it } from 'vitest'
import {
  countCheckboxes,
  countOrderedItems,
  extractSection,
  findHeadings,
  rewriteMarkdownLinks,
  scanMarkdown,
  shiftHeadings
} from '../../src/bmad/markdown'

const FENCED = ['# Real heading', '', '```bash', '# not a heading', 'echo hi', '```', '', '## After'].join('\n')

describe('scanMarkdown', () => {
  it('flags fenced lines', () => {
    const scanned = scanMarkdown(FENCED)
    expect(scanned.fenced[3]).toBe(true)
    expect(scanned.fenced[0]).toBe(false)
  })
})

describe('findHeadings', () => {
  it('ignores headings inside fenced code', () => {
    expect(findHeadings(FENCED).map((heading) => heading.text)).toEqual(['Real heading', 'After'])
  })
})

describe('extractSection', () => {
  const doc = ['## A', 'alpha', '### A1', 'nested', '## B', 'beta'].join('\n')

  it('stops at the next heading of the same or higher level', () => {
    const section = extractSection(doc, (heading) => heading.text === 'A')
    expect(section?.body).toBe('alpha\n### A1\nnested')
  })

  it('returns null when nothing matches', () => {
    expect(extractSection(doc, (heading) => heading.text === 'Z')).toBeNull()
  })
})

describe('shiftHeadings', () => {
  it('shifts outside fences only and clamps to h1..h6', () => {
    const shifted = shiftHeadings(FENCED, 1)
    expect(shifted).toContain('## Real heading')
    expect(shifted).toContain('# not a heading')
    expect(shiftHeadings('###### deep', 2)).toBe('###### deep')
  })
})

describe('countCheckboxes / countOrderedItems', () => {
  const tasks = [
    '- [x] one',
    '  - [x] one a',
    '- [ ] two',
    '```',
    '- [x] inside a fence',
    '```'
  ].join('\n')

  it('counts checked and unchecked items outside fences', () => {
    expect(countCheckboxes(tasks)).toEqual({ total: 3, completed: 2 })
  })

  it('counts top-level ordered items', () => {
    expect(countOrderedItems('1. one\n2. two\n   1. nested\n')).toBe(2)
  })
})

describe('rewriteMarkdownLinks', () => {
  it('rewrites targets outside fences and can replace a whole link', () => {
    const source = ['[a](./a.md)', '```', '[b](./b.md)', '```', '![i](./i.png)'].join('\n')
    const out = rewriteMarkdownLinks(source, (link) =>
      link.isImage ? { replacement: 'IMG' } : { target: '/routed' }
    )
    expect(out).toContain('[a](/routed)')
    expect(out).toContain('[b](./b.md)')
    expect(out).toContain('IMG')
  })

  it('leaves the link untouched when the mapper returns null', () => {
    expect(rewriteMarkdownLinks('[a](./a.md)', () => null)).toBe('[a](./a.md)')
  })
})
