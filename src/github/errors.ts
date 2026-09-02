/** Errors that stop the build, each with a message that says what to fix. */
export class SourceError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
    this.name = 'SourceError'
  }
}

export class AuthenticationError extends SourceError {
  constructor(repository: string) {
    super(
      `GitHub rejected the credentials (401) for ${repository}. Check GITHUB_TOKEN: it may be expired, revoked, or copied incompletely.`,
      'github-unauthorized'
    )
  }
}

export class PermissionError extends SourceError {
  constructor(repository: string, path: string) {
    super(
      `GitHub refused access (403) to ${path} in ${repository}. The fine-grained token must grant "Contents: Read-only" on that repository, and the repository must be within the token's resource owner.`,
      'github-forbidden'
    )
  }
}

export class RateLimitError extends SourceError {
  constructor(
    repository: string,
    readonly resetAt: Date | null
  ) {
    super(
      `GitHub rate limit reached while reading ${repository}${
        resetAt ? `; it resets at ${resetAt.toISOString()}` : ''
      }. Re-run the build later, or use a token with a higher limit.`,
      'github-rate-limited'
    )
  }
}

export class NotFoundError extends SourceError {
  constructor(repository: string, path: string, ref: string) {
    super(
      `${path} was not found in ${repository} at ${ref}. Check BMAD_SPRINT_STATUS and BMAD_REF.`,
      'github-not-found'
    )
  }
}

export class TransportError extends SourceError {
  constructor(repository: string, detail: string) {
    super(`Could not reach the GitHub API for ${repository}: ${detail}`, 'github-transport')
  }
}
