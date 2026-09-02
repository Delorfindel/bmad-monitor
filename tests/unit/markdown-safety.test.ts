import { describe, expect, it } from 'vitest'
import { mapOutsideCodeSpans, sanitizeForVue } from '../../src/generation/markdown-safety'

describe('sanitizeForVue', () => {
  it('neutralises Vue interpolation in prose', () => {
    expect(sanitizeForVue('use {{ value }} here')).toBe('use &#123;&#123; value &#125;&#125; here')
  })

  it('escapes an unknown tag that would break the template compiler', () => {
    expect(sanitizeForVue('clone <owner>/<repo> now')).toBe('clone &lt;owner>/&lt;repo> now')
  })

  it('keeps real HTML tags intact', () => {
    expect(sanitizeForVue('a <br> and <strong>bold</strong>')).toBe(
      'a <br> and <strong>bold</strong>'
    )
  })

  it('leaves fenced code untouched', () => {
    const source = ['```ts', 'const t = `{{ x }}`', 'type A = Map<Key, Value>', '```'].join('\n')
    expect(sanitizeForVue(source)).toBe(source)
  })

  it('leaves inline code spans untouched', () => {
    expect(sanitizeForVue('the type `Record<K, V>` and {{ raw }}')).toBe(
      'the type `Record<K, V>` and &#123;&#123; raw &#125;&#125;'
    )
  })

  it('does not touch HTML comments', () => {
    expect(sanitizeForVue('<!-- {{ note }} -->')).toBe('<!-- {{ note }} -->')
  })
})

describe('mapOutsideCodeSpans', () => {
  it('splits a line on balanced backtick runs', () => {
    expect(mapOutsideCodeSpans('a `b` c', (chunk) => chunk.toUpperCase())).toBe('A `b` C')
  })

  it('treats an unbalanced backtick as literal text', () => {
    expect(mapOutsideCodeSpans('a ` b', (chunk) => chunk.toUpperCase())).toBe('A ` B')
  })
})
