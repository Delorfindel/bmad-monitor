import fs from 'node:fs/promises'
import path from 'node:path'
import type { LocalSourceConfig } from '../config/env.js'
import { normalizeRepoPathOrThrow } from '../shared/paths.js'
import type { ContentSource, SourceRevision } from './types.js'

/**
 * Fixture source: the same contract as the GitHub one, backed by a directory.
 * Paths are normalized first and then re-checked against the root, so a crafted
 * path in a fixture cannot read outside it either.
 */
export class LocalContentSource implements ContentSource {
  readonly revision: SourceRevision

  constructor(private readonly config: LocalSourceConfig) {
    this.revision = {
      repository: config.label,
      ref: 'local',
      commitSha: 'local',
      shortSha: 'local',
      local: true
    }
  }

  private resolve(repoPath: string): string {
    const safePath = normalizeRepoPathOrThrow(repoPath)
    const absolute = path.resolve(this.config.root, safePath)
    const root = path.resolve(this.config.root)
    if (absolute !== root && !absolute.startsWith(root + path.sep)) {
      throw new Error(`Refusing to read ${repoPath}: it resolves outside the local source root.`)
    }
    return absolute
  }

  async read(repoPath: string): Promise<Uint8Array | null> {
    const absolute = this.resolve(repoPath)
    try {
      const stat = await fs.stat(absolute)
      if (!stat.isFile()) return null
      return new Uint8Array(await fs.readFile(absolute))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async readText(repoPath: string): Promise<string | null> {
    const bytes = await this.read(repoPath)
    return bytes === null ? null : new TextDecoder('utf-8').decode(bytes)
  }

  fileUrl(): string | undefined {
    return undefined
  }
}
