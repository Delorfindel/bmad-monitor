import { isExternalLink, normalizeRepoPath, resolveRepoRelative, splitAnchor } from '../shared/paths.js'

export interface MarkdownLink {
  /** The whole `[label](target)` (or `![label](target)`) match. */
  raw: string
  label: string
  target: string
  isImage: boolean
  index: number
}

const INLINE_LINK = /(!?)\[([^\]]*)\]\(\s*<?([^)<>\s]+)>?(?:\s+"[^"]*"|\s+'[^']*')?\s*\)/g
const REFERENCE_DEFINITION = /^[ \t]{0,3}\[([^\]]+)\]:[ \t]*<?([^\s>]+)>?/gm
/** A repository-relative path with at least one directory segment. */
const BARE_DOC_PATH = /(?:[A-Za-z0-9._@+-]+\/)+[A-Za-z0-9._@+-]+\.md(?:#[A-Za-z0-9._-]+)?/g
const ABSOLUTE_URL = /https?:\/\/\S+/g

/** Extracts inline links and images, in document order. */
export function extractMarkdownLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = []
  for (const match of markdown.matchAll(INLINE_LINK)) {
    links.push({
      raw: match[0],
      label: match[2] ?? '',
      target: match[3] ?? '',
      isImage: match[1] === '!',
      index: match.index ?? 0
    })
  }
  return links
}

export type ReferenceKind = 'link' | 'bare'

export interface DocumentReferenceCandidate {
  /** The path exactly as written in the document. */
  raw: string
  kind: ReferenceKind
  /** Repository-relative candidates, most likely first. */
  candidates: string[]
  anchor: string
}

/**
 * BMAD authors write two different kinds of path, and they resolve differently.
 *
 * A Markdown link is relative to the file that contains it, as Markdown says.
 * A path written in prose or between backticks — the dominant form in story
 * Dev Notes and in sprint-status comments — is written from the repository
 * root. Neither convention can be assumed away, so both spellings are offered
 * in priority order and the caller keeps whichever actually exists.
 */
export function referenceCandidates(
  raw: string,
  fromFile: string,
  kind: ReferenceKind
): string[] {
  const fromRoot = normalizeRepoPath(raw)
  const fromDocument = resolveRepoRelative(fromFile, raw)
  const ordered = kind === 'link' ? [fromDocument, fromRoot] : [fromRoot, fromDocument]
  // A document naming itself is not a reference. Without this, the preferred
  // spelling is discarded and the fallback resolves to a path that cannot exist.
  if (ordered[0] === fromFile) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const candidate of ordered) {
    if (candidate === null || candidate === fromFile || seen.has(candidate)) continue
    seen.add(candidate)
    out.push(candidate)
  }
  return out
}

/**
 * Every Markdown document explicitly named by `text`, in document order.
 *
 * Both spellings are collected: Markdown links, and bare or backticked paths —
 * BMAD authors write `_bmad-output/planning-artifacts/x.md` far more often than
 * they write a real link, and a YAML comment can only carry the bare form.
 */
export function extractDocumentReferences(
  text: string,
  fromFile: string
): DocumentReferenceCandidate[] {
  const found: DocumentReferenceCandidate[] = []
  const seen = new Set<string>()

  const add = (target: string, kind: ReferenceKind): void => {
    const { path, anchor } = splitAnchor(target.trim())
    if (!path.toLowerCase().endsWith('.md')) return
    const candidates = referenceCandidates(path, fromFile, kind)
    if (candidates.length === 0) return
    const identity = `${kind}:${candidates.join('|')}`
    if (seen.has(identity)) return
    seen.add(identity)
    found.push({ raw: path, kind, candidates, anchor })
  }

  for (const link of extractMarkdownLinks(text)) {
    if (link.isImage || isExternalLink(link.target)) continue
    add(link.target, 'link')
  }

  for (const match of text.matchAll(REFERENCE_DEFINITION)) {
    const target = match[2] ?? ''
    if (isExternalLink(target)) continue
    add(target, 'link')
  }

  // Bare paths last, and only after absolute URLs are blanked out, so that the
  // tail of `https://host/a/b.md` is never mistaken for a repository file.
  const withoutUrls = text.replace(ABSOLUTE_URL, ' ')
  for (const match of withoutUrls.matchAll(BARE_DOC_PATH)) {
    add(match[0], 'bare')
  }

  return found
}

/** Repository-relative image candidates referenced by a document, in order. */
export function extractImageReferences(
  markdown: string,
  fromFile: string
): DocumentReferenceCandidate[] {
  const found: DocumentReferenceCandidate[] = []
  const seen = new Set<string>()
  const add = (target: string): void => {
    if (isExternalLink(target)) return
    const { path, anchor } = splitAnchor(target.trim())
    const candidates = referenceCandidates(path, fromFile, 'link')
    if (candidates.length === 0) return
    const identity = candidates.join('|')
    if (seen.has(identity)) return
    seen.add(identity)
    found.push({ raw: path, kind: 'link', candidates, anchor })
  }

  for (const link of extractMarkdownLinks(markdown)) {
    if (link.isImage) add(link.target)
  }
  // `<img src="...">` is common in hand-written BMAD docs.
  for (const match of markdown.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    add(match[1] ?? '')
  }
  return found
}

/** A human title for a document we may not have been able to download. */
export function titleFromPath(path: string): string {
  const base = (normalizeRepoPath(path) ?? path).split('/').pop() ?? path
  const withoutExtension = base.replace(/\.[a-z0-9]+$/i, '')
  return withoutExtension
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => (word.length <= 2 ? word : word[0]!.toUpperCase() + word.slice(1)))
    .join(' ')
}

/** First ATX heading of a Markdown document, used as its title. */
export function titleFromMarkdown(markdown: string): string | null {
  const match = /^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(stripFrontmatter(markdown).body)
  return match ? match[1]!.trim() : null
}

export interface FrontmatterSplit {
  frontmatter: string
  body: string
}

export function stripFrontmatter(markdown: string): FrontmatterSplit {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(markdown)
  if (!match) return { frontmatter: '', body: markdown }
  return { frontmatter: match[1] ?? '', body: markdown.slice(match[0].length) }
}
