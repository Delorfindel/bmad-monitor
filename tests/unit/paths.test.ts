import { describe, expect, it } from 'vitest'
import {
  isExternalLink,
  joinRepoPath,
  normalizeRepoPath,
  normalizeRepoPathOrThrow,
  PathRejectedError,
  repoDirname,
  resolveRepoRelative,
  splitAnchor
} from '../../src/shared/paths'

describe('normalizeRepoPath', () => {
  it('normalizes a plain repository-relative path', () => {
    expect(normalizeRepoPath('_bmad-output/./stories//12-1.md')).toBe('_bmad-output/stories/12-1.md')
  })

  it('collapses inner traversal that stays inside the repository', () => {
    expect(normalizeRepoPath('a/b/../c.md')).toBe('a/c.md')
  })

  it.each([
    ['../../etc/passwd', 'traversal above the root'],
    ['a/../../b.md', 'traversal that escapes after descending'],
    ['/etc/passwd', 'absolute POSIX path'],
    ['C:/Windows/system32', 'Windows drive path'],
    ['..\\..\\secrets', 'backslash separators'],
    ['https://example.com/a.md', 'absolute URL'],
    ['//example.com/a.md', 'protocol-relative URL'],
    ['file:///etc/passwd', 'file protocol'],
    ['~/secrets.md', 'home-relative path'],
    ['a/\0/b.md', 'null byte'],
    ['', 'empty string'],
    ['.', 'current directory only']
  ])('rejects %s (%s)', (input) => {
    expect(normalizeRepoPath(input)).toBeNull()
  })

  it('rejects paths that are absurdly long or deep', () => {
    expect(normalizeRepoPath(`${'a/'.repeat(40)}b.md`)).toBeNull()
    expect(normalizeRepoPath(`${'a'.repeat(600)}.md`)).toBeNull()
  })

  it('throws a typed error when a path must be safe', () => {
    expect(() => normalizeRepoPathOrThrow('../escape')).toThrow(PathRejectedError)
  })
})

describe('resolveRepoRelative', () => {
  it('resolves against the directory of the containing file', () => {
    expect(resolveRepoRelative('docs/sprint/story.md', '../planning/epics.md')).toBe(
      'docs/planning/epics.md'
    )
  })

  it('treats a leading slash as the repository root', () => {
    expect(resolveRepoRelative('docs/sprint/story.md', '/planning/epics.md')).toBe(
      'planning/epics.md'
    )
  })

  it('refuses to escape the repository', () => {
    expect(resolveRepoRelative('a/b.md', '../../../etc/passwd')).toBeNull()
  })

  it('ignores anchors and external links', () => {
    expect(resolveRepoRelative('a/b.md', '#section')).toBeNull()
    expect(resolveRepoRelative('a/b.md', 'https://example.com')).toBeNull()
  })
})

describe('helpers', () => {
  it('splits an anchor', () => {
    expect(splitAnchor('a/b.md#part-one')).toEqual({ path: 'a/b.md', anchor: '#part-one' })
    expect(splitAnchor('a/b.md')).toEqual({ path: 'a/b.md', anchor: '' })
  })

  it('detects external links', () => {
    expect(isExternalLink('https://example.com')).toBe(true)
    expect(isExternalLink('mailto:a@b.c')).toBe(true)
    expect(isExternalLink('./a.md')).toBe(false)
  })

  it('computes directories and joins safely', () => {
    expect(repoDirname('a/b/c.md')).toBe('a/b')
    expect(repoDirname('c.md')).toBe('')
    expect(joinRepoPath('a/b', 'c.md')).toBe('a/b/c.md')
    expect(joinRepoPath('a/b', '../../../c.md')).toBeNull()
  })
})
