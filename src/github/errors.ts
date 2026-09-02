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

/**
 * GitHub answers 404, not 403, for a private repository the credentials cannot
 * see — it refuses to confirm that the repository exists at all. So this is the
 * single most common first-deployment failure, and the message has to name
 * every plausible cause rather than blaming the path.
 */
export class RepositoryAccessError extends SourceError {
  constructor(repository: string) {
    const [owner] = repository.split('/')
    super(
      [
        `${repository} is not visible with the configured GITHUB_TOKEN.`,
        'GitHub answers 404 for a private repository the token cannot see, so this is an access problem more often than a typo. Check, in order:',
        `  1. The token's resource owner is "${owner}". A fine-grained token can only reach ${owner}'s repositories if it was created with ${owner} as the resource owner, not a personal account.`,
        `  2. ${repository} is listed under "Only select repositories" on the token.`,
        '  3. Repository permissions include "Contents: Read-only".',
        `  4. If ${owner} is an organization, it allows fine-grained tokens, and an owner has approved this one (Organization settings → Personal access tokens). A pending request behaves exactly like no access.`,
        '  5. BMAD_REPOSITORY spells the repository correctly, and the token was pasted in full and has not expired.'
      ].join('\n'),
      'github-repository-unreachable'
    )
  }
}

export class RefNotFoundError extends SourceError {
  constructor(repository: string, ref: string, defaultBranch: string) {
    super(
      `BMAD_REF is "${ref}", which does not exist in ${repository}. The repository's default branch is "${defaultBranch}".`,
      'github-ref-not-found'
    )
  }
}

export class TransportError extends SourceError {
  constructor(repository: string, detail: string) {
    super(`Could not reach the GitHub API for ${repository}: ${detail}`, 'github-transport')
  }
}
