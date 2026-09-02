/**
 * Every path handled here comes from YAML or Markdown authored inside the
 * monitored repository, so none of it is trusted. The only shape allowed out of
 * this module is a POSIX, repository-relative path with no `..` left in it.
 */

const WINDOWS_DRIVE = /^[a-zA-Z]:[\\/]/
const PROTOCOL = /^[a-zA-Z][a-zA-Z0-9+.-]*:/
const MAX_SEGMENTS = 32
const MAX_LENGTH = 512

export class PathRejectedError extends Error {
  constructor(
    readonly input: string,
    readonly reason: string
  ) {
    super(`Rejected path ${JSON.stringify(input)}: ${reason}`)
    this.name = 'PathRejectedError'
  }
}

/** `true` for anything that must be treated as a link out of the repository. */
export function isExternalLink(target: string): boolean {
  const trimmed = target.trim()
  return (
    trimmed.startsWith('//') ||
    (PROTOCOL.test(trimmed) && !WINDOWS_DRIVE.test(trimmed))
  )
}

export function isAnchorLink(target: string): boolean {
  return target.trim().startsWith('#')
}

/**
 * Normalizes a repository-relative POSIX path, or returns `null` when the input
 * cannot be represented as one. Never throws — callers decide how loud to be.
 */
export function normalizeRepoPath(input: string): string | null {
  const raw = input.trim()
  if (raw === '') return null
  if (raw.length > MAX_LENGTH) return null
  if (raw.includes('\0')) return null
  if (raw.includes('\\')) return null
  if (WINDOWS_DRIVE.test(raw)) return null
  if (isExternalLink(raw)) return null
  if (raw.startsWith('/')) return null
  if (raw.startsWith('~')) return null

  const [withoutHash] = raw.split('#')
  const [pathPart] = (withoutHash ?? '').split('?')
  if (!pathPart) return null

  const out: string[] = []
  for (const segment of pathPart.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      // Escaping the repository root is the traversal we exist to stop.
      if (out.length === 0) return null
      out.pop()
      continue
    }
    out.push(segment)
  }

  if (out.length === 0) return null
  if (out.length > MAX_SEGMENTS) return null
  return out.join('/')
}

export function normalizeRepoPathOrThrow(input: string): string {
  const normalized = normalizeRepoPath(input)
  if (normalized === null) {
    throw new PathRejectedError(input, 'not a safe repository-relative path')
  }
  return normalized
}

/** Directory part of a repository-relative path (`''` for a root-level file). */
export function repoDirname(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

/** Resolves a link found inside `fromFile` against the repository root. */
export function resolveRepoRelative(fromFile: string, target: string): string | null {
  const raw = target.trim()
  if (raw === '') return null
  if (isExternalLink(raw) || isAnchorLink(raw)) return null
  if (raw.startsWith('/')) {
    // Root-relative links inside BMAD docs mean "from the repository root".
    return normalizeRepoPath(raw.slice(1))
  }
  const dir = repoDirname(fromFile)
  return normalizeRepoPath(dir === '' ? raw : `${dir}/${raw}`)
}

/** Splits `docs/a.md#section` into its path and anchor halves. */
export function splitAnchor(target: string): { path: string; anchor: string } {
  const index = target.indexOf('#')
  if (index === -1) return { path: target, anchor: '' }
  return { path: target.slice(0, index), anchor: target.slice(index) }
}

export function joinRepoPath(base: string, relative: string): string | null {
  return normalizeRepoPath(base === '' ? relative : `${base}/${relative}`)
}
