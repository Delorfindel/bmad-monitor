/**
 * Timestamps are shown exactly as the sprint status wrote them — date and time
 * of day, no timezone conversion. Converting would both mislead (the sprint's
 * own clock is the meaningful one) and desynchronise server and client render.
 */
export function formatTimestamp(value: string | undefined): string | null {
  if (!value) return null
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(value.trim())
  if (!match) return value.trim()
  return match[2] ? `${match[1]} ${match[2]}` : (match[1] as string)
}

export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100)
}

/** Splits a plain-text block into paragraphs and inline code runs. */
export interface TextToken {
  code: boolean
  text: string
}

export function tokenizeParagraph(text: string): TextToken[] {
  const tokens: TextToken[] = []
  let index = 0
  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const start = match.index ?? 0
    if (start > index) tokens.push({ code: false, text: text.slice(index, start) })
    tokens.push({ code: true, text: match[1] as string })
    index = start + match[0].length
  }
  if (index < text.length) tokens.push({ code: false, text: text.slice(index) })
  return tokens
}

/**
 * Comment blocks are hard-wrapped in the YAML file. Blank lines are the real
 * paragraph breaks; the wrapping newlines inside one are just the file's line
 * width and must not survive into a fluid layout.
 */
export function toParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter((paragraph) => paragraph !== '')
}
