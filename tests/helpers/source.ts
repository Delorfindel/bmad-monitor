import type { ContentSource, SourceRevision } from '../../src/github/types'

/** In-memory `ContentSource` for tests: the same contract, no I/O. */
export class FakeContentSource implements ContentSource {
  readonly revision: SourceRevision
  readonly reads: string[] = []

  constructor(
    private readonly files: Record<string, string | Uint8Array>,
    revision: Partial<SourceRevision> = {}
  ) {
    this.revision = {
      repository: 'acme/atlas',
      ref: 'main',
      commitSha: 'a'.repeat(40),
      shortSha: 'aaaaaaa',
      local: false,
      commitUrl: `https://github.com/acme/atlas/commit/${'a'.repeat(40)}`,
      ...revision
    }
  }

  async read(path: string): Promise<Uint8Array | null> {
    this.reads.push(path)
    const value = this.files[path]
    if (value === undefined) return null
    return typeof value === 'string' ? new TextEncoder().encode(value) : value
  }

  async readText(path: string): Promise<string | null> {
    const bytes = await this.read(path)
    return bytes === null ? null : new TextDecoder().decode(bytes)
  }

  fileUrl(path: string): string | undefined {
    if (this.revision.local) return undefined
    return `https://github.com/${this.revision.repository}/blob/${this.revision.commitSha}/${path}`
  }
}
