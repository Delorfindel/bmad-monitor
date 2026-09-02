import { findHeadings, sectionAt, shiftHeadings, trimBlankEdges, type MarkdownHeading } from './markdown.js'

export interface EpicPlanningSection {
  /** Heading text, e.g. `Epic 41: Trusted Soundcharts Album-First Preparation`. */
  heading: string
  /** Title without the `Epic 41:` prefix. */
  title: string
  level: number
  /** Body with inner headings normalized so the page keeps one `h1`. */
  body: string
}

function epicHeadingNumber(heading: MarkdownHeading): number | null {
  const match = /^epic[\s_-]*0*(\d+)\b/i.exec(heading.text.replace(/^[#\s*]+/, ''))
  return match ? Number(match[1]) : null
}

function epicTitle(headingText: string): string {
  const withoutNumber = headingText.replace(/^epic[\s_-]*0*\d+\s*[:—–-]?\s*/i, '').trim()
  return withoutNumber === '' ? headingText.trim() : withoutNumber
}

/**
 * Finds the section describing `epicNumber` in a planning document.
 *
 * Planning files usually name each epic twice: once as a one-line entry in an
 * "Epic List" summary and once as the full section. The richest candidate wins,
 * which picks the real section without depending on heading levels.
 */
export function extractEpicSection(
  markdown: string,
  epicNumber: number
): EpicPlanningSection | null {
  const headings = findHeadings(markdown)
  let best: EpicPlanningSection | null = null
  let bestWeight = -1

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index] as MarkdownHeading
    if (epicHeadingNumber(heading) !== epicNumber) continue
    const section = sectionAt(markdown, headings, index)
    const weight = section.body.length
    if (weight <= bestWeight) continue
    bestWeight = weight
    best = {
      heading: heading.text,
      title: epicTitle(heading.text),
      level: heading.level,
      body: section.body
    }
  }

  if (best === null || trimBlankEdges(best.body) === '') return best === null ? null : { ...best, body: '' }
  // The extracted section becomes the body of a page whose h1 is the epic
  // itself, so its own sub-headings start at h2.
  return { ...best, body: shiftHeadings(best.body, 2 - best.level) }
}

/** Epic titles found anywhere in the planning document, by epic number. */
export function collectEpicTitles(markdown: string): Map<number, string> {
  const titles = new Map<number, string>()
  for (const heading of findHeadings(markdown)) {
    const number = epicHeadingNumber(heading)
    if (number === null) continue
    const title = epicTitle(heading.text)
    const existing = titles.get(number)
    if (existing === undefined || existing.length < title.length) titles.set(number, title)
  }
  return titles
}
