import { createHash } from 'node:crypto'

/** Routes are derived from the sprint status keys, so they are stable across builds. */

export const DASHBOARD_ROUTE = '/'

export function epicRoute(epicNumber: number): string {
  return `/epics/${epicNumber}`
}

export function storyRoute(storyKey: string): string {
  return `/stories/${storyKey}`
}

export function contextRoute(slug: string): string {
  return `/context/${slug}`
}

export function epicPageFile(epicNumber: number): string {
  return `epics/${epicNumber}.md`
}

export function storyPageFile(storyKey: string): string {
  return `stories/${storyKey}.md`
}

export function contextPageFile(slug: string): string {
  return `context/${slug}.md`
}

/**
 * A content-addressed public path for a repository asset. Private repositories
 * cannot be linked to `raw.githubusercontent.com` from the browser, so every
 * referenced asset is copied into the static site instead.
 */
export function assetPublicPath(repoPath: string): string {
  const digest = createHash('sha1').update(repoPath).digest('hex').slice(0, 10)
  const base = (repoPath.split('/').pop() ?? 'asset').replace(/[^A-Za-z0-9._-]/g, '-')
  return `/assets/${digest}-${base}`
}
