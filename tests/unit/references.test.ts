import { describe, expect, it } from 'vitest'
import {
  extractDocumentReferences,
  extractImageReferences,
  extractMarkdownLinks,
  referenceCandidates,
  stripFrontmatter,
  titleFromMarkdown,
  titleFromPath
} from '../../src/bmad/references'

const FROM = '_bmad-output/implementation-artifacts/sprint-6/41-3-story.md'

describe('referenceCandidates', () => {
  it('prefers the repository root for a bare path and the file for a link', () => {
    expect(referenceCandidates('_bmad-output/planning/x.md', FROM, 'bare')[0]).toBe(
      '_bmad-output/planning/x.md'
    )
    expect(referenceCandidates('../../planning/x.md', FROM, 'link')[0]).toBe(
      '_bmad-output/planning/x.md'
    )
  })

  it('offers the other convention as a fallback', () => {
    expect(referenceCandidates('notes.md', FROM, 'bare')).toEqual([
      'notes.md',
      '_bmad-output/implementation-artifacts/sprint-6/notes.md'
    ])
  })

  it('drops a document that names itself', () => {
    expect(referenceCandidates(FROM, FROM, 'bare')).toEqual([])
  })

  it('drops anything that escapes the repository', () => {
    expect(referenceCandidates('../../../../../etc/passwd.md', FROM, 'link')).toEqual([])
  })
})

describe('extractDocumentReferences', () => {
  const text = [
    'See [the plan](../../planning-artifacts/epics.md) and',
    'the pause note `_bmad-output/planning-artifacts/pause.md`.',
    'External: [site](https://example.com/a.md) must be ignored.',
    'A bare URL https://example.com/deep/other.md is not a repository file.',
    '',
    '[ref]: ../../planning-artifacts/reference-style.md'
  ].join('\n')

  const found = extractDocumentReferences(text, FROM)
  const primaries = found.map((group) => group.candidates[0])

  it('finds Markdown links, reference definitions and backticked paths', () => {
    expect(primaries).toContain('_bmad-output/planning-artifacts/epics.md')
    expect(primaries).toContain('_bmad-output/planning-artifacts/pause.md')
    expect(primaries).toContain('_bmad-output/planning-artifacts/reference-style.md')
  })

  it('never turns an absolute URL into a repository path', () => {
    expect(primaries.some((path) => path?.includes('example.com'))).toBe(false)
    expect(primaries.some((path) => path?.endsWith('deep/other.md'))).toBe(false)
  })

  it('ignores non-Markdown paths', () => {
    const refs = extractDocumentReferences('see `services/tiles/contract.ts`', FROM)
    expect(refs).toEqual([])
  })

  it('reads paths written in a YAML comment body', () => {
    const comment = [
      'Full context, including what is deferred and why:',
      '`_bmad-output/implementation-artifacts/sprint-6/pause-2026-08-27.md`'
    ].join('\n')
    const refs = extractDocumentReferences(comment, 'sprint/sprint-status.yaml')
    expect(refs[0]?.candidates[0]).toBe(
      '_bmad-output/implementation-artifacts/sprint-6/pause-2026-08-27.md'
    )
  })
})

describe('extractImageReferences', () => {
  it('finds Markdown images and img tags, and ignores external ones', () => {
    const refs = extractImageReferences(
      '![a](../assets/one.png)\n<img src="../assets/two.svg">\n![b](https://x.test/three.png)',
      'docs/story.md'
    )
    expect(refs.map((group) => group.candidates[0])).toEqual(['assets/one.png', 'assets/two.svg'])
  })
})

describe('helpers', () => {
  it('splits front matter', () => {
    expect(stripFrontmatter('---\na: 1\n---\nbody\n')).toEqual({ frontmatter: 'a: 1', body: 'body\n' })
    expect(stripFrontmatter('no front matter').frontmatter).toBe('')
  })

  it('reads a title from the first heading or from the path', () => {
    expect(titleFromMarkdown('---\na: 1\n---\n\n# Real Title\n')).toBe('Real Title')
    expect(titleFromMarkdown('no heading')).toBeNull()
    expect(titleFromPath('_bmad-output/planning/tile-ingest-pause.md')).toBe('Tile Ingest Pause')
  })

  it('reports link positions and image flags', () => {
    const links = extractMarkdownLinks('![i](a.png) and [l](b.md)')
    expect(links.map((link) => link.isImage)).toEqual([true, false])
  })
})
