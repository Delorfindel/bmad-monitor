/**
 * Timestamps are shown exactly as the sprint status wrote them — date and time
 * of day, no timezone conversion. Converting would both mislead (the sprint's
 * own clock is the meaningful one) and desynchronise server and client render.
 */
export type DateOrder = 'mdy' | 'dmy'

const SHORT_DATE = /^(\d{2})[-/](\d{2})[-/](\d{4})(?:[T ](\d{2}:\d{2}))?/

/**
 * Which way round a `xx-xx-yyyy` file writes its dates, decided from the values
 * that cannot be read both ways. A sprint status is internally consistent, so
 * one unambiguous date settles every other date in the same file — which is the
 * only honest way to read `09-02-2026`.
 */
export function detectDateOrder(...values: (string | undefined)[]): DateOrder | null {
  for (const value of values) {
    const match = value === undefined ? null : SHORT_DATE.exec(value.trim())
    if (!match) continue
    const first = Number(match[1])
    const second = Number(match[2])
    if (first > 12 && second <= 12) return 'dmy'
    if (second > 12 && first <= 12) return 'mdy'
  }
  return null
}

export function formatTimestamp(value: string | undefined, order: DateOrder | null = null): string | null {
  if (!value) return null
  const text = value.trim()

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(text)
  if (iso) return join(iso[1], iso[2], iso[3], iso[4])

  // BMAD files are not consistent about this: `08-20-2026 17:23` also occurs.
  // A date is only reordered when its own digits, or `order`, make the reading
  // certain; otherwise it is shown exactly as written rather than guessed at.
  const short = SHORT_DATE.exec(text)
  if (short) {
    const first = Number(short[1])
    const second = Number(short[2])
    const reading =
      first > 12 && second <= 12 ? 'dmy' : second > 12 && first <= 12 ? 'mdy' : order
    if (reading === 'dmy') return join(short[3], short[2], short[1], short[4])
    if (reading === 'mdy') return join(short[3], short[1], short[2], short[4])
    return text
  }

  return text
}

function join(
  year: string | undefined,
  month: string | undefined,
  day: string | undefined,
  time: string | undefined
): string {
  const date = `${year}-${month}-${day}`
  return time ? `${date} ${time}` : date
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
