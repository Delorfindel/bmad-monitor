import { scanMarkdown } from '../bmad/markdown.js'

/**
 * VitePress compiles every Markdown page into a Vue template, so two ordinary
 * pieces of technical prose become build errors: `{{ x }}` is read as an
 * interpolation, and `<owner>/<repo>` is read as an unclosed element.
 *
 * Both are neutralized with HTML entities, which render as the original
 * characters — the document still reads exactly as its author wrote it. Code
 * fences and inline code spans are left untouched, because entities inside them
 * would be shown literally.
 */

const HTML_TAGS = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo',
  'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
  'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label',
  'legend', 'li', 'link', 'main', 'map', 'mark', 'menu', 'meta', 'meter', 'nav', 'noscript',
  'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'picture', 'pre', 'progress',
  'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 'slot', 'small', 'source',
  'span', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template',
  'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video',
  'wbr', 'svg', 'path', 'circle', 'rect', 'g', 'line', 'polygon', 'polyline', 'text', 'defs'
])

const TAG_LIKE = /<\/?([A-Za-z][A-Za-z0-9]*)/g

/** Applies `transform` to the parts of a line that are not inside code spans. */
export function mapOutsideCodeSpans(line: string, transform: (chunk: string) => string): string {
  let out = ''
  let index = 0
  while (index < line.length) {
    const tick = line.indexOf('`', index)
    if (tick === -1) {
      out += transform(line.slice(index))
      break
    }
    out += transform(line.slice(index, tick))

    let runLength = 0
    while (line[tick + runLength] === '`') runLength += 1
    const fence = '`'.repeat(runLength)
    const close = line.indexOf(fence, tick + runLength)
    if (close === -1) {
      // An unbalanced backtick is literal text, not a code span.
      out += line.slice(tick, tick + runLength)
      index = tick + runLength
      continue
    }
    out += line.slice(tick, close + runLength)
    index = close + runLength
  }
  return out
}

function escapeChunk(chunk: string): string {
  return chunk
    .replace(/\{\{/g, '&#123;&#123;')
    .replace(/\}\}/g, '&#125;&#125;')
    .replace(TAG_LIKE, (whole, name: string) =>
      HTML_TAGS.has(name.toLowerCase()) ? whole : `&lt;${whole.slice(1)}`
    )
}

export function sanitizeForVue(markdown: string): string {
  const { lines, fenced } = scanMarkdown(markdown)
  return lines
    .map((line, index) => {
      if (fenced[index]) return line
      if (line.trimStart().startsWith('<!--')) return line
      return mapOutsideCodeSpans(line, escapeChunk)
    })
    .join('\n')
}
