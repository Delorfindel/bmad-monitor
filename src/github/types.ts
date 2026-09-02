export interface SourceRevision {
  /** `owner/name`, or the fixture directory in local mode. */
  repository: string
  ref: string
  /** Full commit SHA, or `local` for a fixture build. */
  commitSha: string
  shortSha: string
  local: boolean
  commitUrl?: string
}

/**
 * Read-only view of one repository pinned to one revision. The GitHub and
 * fixture implementations are interchangeable, which is what lets the whole
 * pipeline be tested without a token.
 */
export interface ContentSource {
  readonly revision: SourceRevision
  /** `null` when the file does not exist; throws for every other failure. */
  read(path: string): Promise<Uint8Array | null>
  readText(path: string): Promise<string | null>
  /** A human-facing URL for the file, when the source can build one. */
  fileUrl(path: string): string | undefined
}
