import { createHash } from 'node:crypto'

/** Routes are derived from the sprint status keys, so they are stable across builds. */

export const DASHBOARD_ROUTE = '/'

/**
 * Builds the site's routes. Their shape depends on one thing: whether the host
 * serves `/epics/41` from `epics/41.html` on its own.
 *
 * Vercel does, with `cleanUrls`. Most static hosts do not, and there every
 * extensionless link is a 404 on first load — so the extension goes into the
 * routes themselves rather than being papered over with a rewrite rule.
 */
export interface RouteBuilder {
  epic(epicNumber: number): string
  story(storyKey: string): string
  context(slug: string): string
}

export function createRouteBuilder(cleanUrls: boolean): RouteBuilder {
  const suffix = cleanUrls ? '' : '.html'
  return {
    epic: (epicNumber) => `/epics/${epicNumber}${suffix}`,
    story: (storyKey) => `/stories/${storyKey}${suffix}`,
    context: (slug) => `/context/${slug}${suffix}`
  }
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
