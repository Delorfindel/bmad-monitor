/** Line-oriented Markdown helpers shared by the story and planning parsers. */

const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})/
const ATX_HEADING = /^[ \t]{0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/

export interface MarkdownHeading {
  level: number
  text: string
  lineIndex: number
}

export interface ScannedMarkdown {
  lines: string[]
  /** `true` when the line at the same index sits inside a fenced code block. */
  fenced: boolean[]
}

/**
 * Splits into lines and flags fenced regions, so nothing below ever treats a
 * `# comment` inside a shell block as a heading or rewrites a link in a sample.
 */
export function scanMarkdown(markdown: string): ScannedMarkdown {
  const lines = markdown.split('\n')
  const fenced = new Array<boolean>(lines.length).fill(false)
  let openFence: string | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string
    const match = FENCE.exec(line)
    if (openFence === null) {
      if (match) {
        openFence = (match[1] as string)[0] as string
        fenced[index] = true
      }
      continue
    }
    fenced[index] = true
    if (match && (match[1] as string)[0] === openFence) {
      openFence = null
    }
  }
  return { lines, fenced }
}

export function findHeadings(markdown: string): MarkdownHeading[] {
  const { lines, fenced } = scanMarkdown(markdown)
  const headings: MarkdownHeading[] = []
  for (let index = 0; index < lines.length; index += 1) {
    if (fenced[index]) continue
    const match = ATX_HEADING.exec(lines[index] as string)
    if (!match) continue
    headings.push({
      level: (match[1] as string).length,
      text: (match[2] as string).trim(),
      lineIndex: index
    })
  }
  return headings
}

export interface MarkdownSection {
  heading: MarkdownHeading
  /** Body without the heading line itself. */
  body: string
}

/**
 * The section opened by the first heading matching `predicate`, ending at the
 * next heading of the same level or higher.
 */
export function extractSection(
  markdown: string,
  predicate: (heading: MarkdownHeading) => boolean
): MarkdownSection | null {
  const headings = findHeadings(markdown)
  const startIndex = headings.findIndex(predicate)
  if (startIndex === -1) return null
  return sectionAt(markdown, headings, startIndex)
}

export function sectionAt(
  markdown: string,
  headings: MarkdownHeading[],
  index: number
): MarkdownSection {
  const heading = headings[index] as MarkdownHeading
  const lines = markdown.split('\n')
  const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level)
  const end = next ? next.lineIndex : lines.length
  const body = lines.slice(heading.lineIndex + 1, end).join('\n')
  return { heading, body: trimBlankEdges(body) }
}

export function trimBlankEdges(text: string): string {
  return text.replace(/^(?:[ \t]*\n)+/, '').replace(/(?:\n[ \t]*)+$/, '')
}

/** Shifts every non-fenced ATX heading by `delta`, clamped to 1..6. */
export function shiftHeadings(markdown: string, delta: number): string {
  if (delta === 0) return markdown
  const { lines, fenced } = scanMarkdown(markdown)
  return lines
    .map((line, index) => {
      if (fenced[index]) return line
      const match = ATX_HEADING.exec(line)
      if (!match) return line
      const level = Math.min(6, Math.max(1, (match[1] as string).length + delta))
      return `${'#'.repeat(level)} ${match[2] as string}`
    })
    .join('\n')
}

const LINK_TARGET =
  /(!?)\[([^\]]*)\]\(\s*<?([^)<>\s]+)>?((?:\s+"[^"]*"|\s+'[^']*')?)\s*\)/g
const REFERENCE_TARGET = /^([ \t]{0,3}\[[^\]]+\]:[ \t]*)<?([^\s>]+)>?(.*)$/

export interface LinkRewrite {
  target: string
  label: string
  isImage: boolean
}

/**
 * What a link mapper decides: a new target, a full replacement for the link
 * (used when a document is not part of this deployment and there is nowhere to
 * point at), or `null` to leave the link alone.
 */
export type LinkDecision = { target: string } | { replacement: string } | null

/** Rewrites link and image targets outside fenced code. */
export function rewriteMarkdownLinks(
  markdown: string,
  mapper: (link: LinkRewrite) => LinkDecision
): string {
  const { lines, fenced } = scanMarkdown(markdown)
  return lines
    .map((line, index) => {
      if (fenced[index]) return line
      const rewritten = line.replace(
        LINK_TARGET,
        (whole, bang: string, label: string, target: string, title: string) => {
          const decision = mapper({ target, label, isImage: bang === '!' })
          if (decision === null) return whole
          if ('replacement' in decision) return decision.replacement
          return `${bang}[${label}](${decision.target}${title})`
        }
      )
      const referenceMatch = REFERENCE_TARGET.exec(rewritten)
      if (referenceMatch) {
        const decision = mapper({
          target: referenceMatch[2] as string,
          label: '',
          isImage: false
        })
        if (decision !== null && 'target' in decision) {
          return `${referenceMatch[1] as string}${decision.target}${referenceMatch[3] as string}`
        }
      }
      return rewritten
    })
    .join('\n')
}

/** Counts `- [ ]` / `- [x]` items outside fenced code. */
export function countCheckboxes(markdown: string): { total: number; completed: number } {
  const { lines, fenced } = scanMarkdown(markdown)
  let total = 0
  let completed = 0
  for (let index = 0; index < lines.length; index += 1) {
    if (fenced[index]) continue
    const match = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[([ xX])\]/.exec(lines[index] as string)
    if (!match) continue
    total += 1
    if ((match[1] as string).toLowerCase() === 'x') completed += 1
  }
  return { total, completed }
}

/** Counts top-level ordered list items outside fenced code. */
export function countOrderedItems(markdown: string): number {
  const { lines, fenced } = scanMarkdown(markdown)
  let total = 0
  for (let index = 0; index < lines.length; index += 1) {
    if (fenced[index]) continue
    if (/^\d+[.)][ \t]+\S/.test(lines[index] as string)) total += 1
  }
  return total
}
