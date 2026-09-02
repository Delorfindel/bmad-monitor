import type { AppConfig } from '../config/env.js'
import type { Logger } from '../shared/logger.js'
import { GithubContentSource, type GithubClientDeps } from './client.js'
import { LocalContentSource } from './local.js'
import type { ContentSource } from './types.js'

export * from './errors.js'
export * from './types.js'
export { GithubContentSource } from './client.js'
export { LocalContentSource } from './local.js'

export async function createContentSource(
  config: AppConfig,
  deps: GithubClientDeps & { logger?: Logger } = {}
): Promise<ContentSource> {
  if (config.source.mode === 'local') return new LocalContentSource(config.source)
  return GithubContentSource.create(config.source, deps)
}
