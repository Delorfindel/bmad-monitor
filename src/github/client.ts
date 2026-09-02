import type { GithubSourceConfig } from '../config/env.js'
import { sleep } from '../shared/concurrency.js'
import { silentLogger, type Logger } from '../shared/logger.js'
import { normalizeRepoPathOrThrow } from '../shared/paths.js'
import {
  AuthenticationError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  TransportError
} from './errors.js'
import type { ContentSource, SourceRevision } from './types.js'

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface GithubClientDeps {
  fetch?: FetchLike
  logger?: Logger
  /** Injected in tests so backoff does not slow the suite down. */
  sleep?: (ms: number) => Promise<void>
  maxAttempts?: number
}

const USER_AGENT = 'bmad-monitor'
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])

function encodeRepoPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

function parseResetHeader(response: Response): Date | null {
  const reset = response.headers.get('x-ratelimit-reset')
  if (reset === null) return null
  const seconds = Number(reset)
  return Number.isFinite(seconds) ? new Date(seconds * 1000) : null
}

function isRateLimited(response: Response): boolean {
  return (
    response.headers.get('x-ratelimit-remaining') === '0' ||
    (response.headers.get('retry-after') !== null && response.status === 403)
  )
}

export class GithubContentSource implements ContentSource {
  readonly revision: SourceRevision

  private constructor(
    private readonly config: GithubSourceConfig,
    private readonly deps: Required<GithubClientDeps>,
    commitSha: string
  ) {
    this.revision = {
      repository: config.repository.full,
      ref: config.ref,
      commitSha,
      shortSha: commitSha.slice(0, 7),
      local: false,
      commitUrl: `https://github.com/${config.repository.full}/commit/${commitSha}`
    }
  }

  /**
   * Resolves `BMAD_REF` to a commit SHA once, then pins every later read to it.
   * A push during the build can therefore never mix two commits into one site.
   */
  static async create(
    config: GithubSourceConfig,
    deps: GithubClientDeps = {}
  ): Promise<GithubContentSource> {
    const resolved: Required<GithubClientDeps> = {
      fetch: deps.fetch ?? ((url, init) => globalThis.fetch(url, init)),
      logger: deps.logger ?? silentLogger,
      sleep: deps.sleep ?? sleep,
      maxAttempts: deps.maxAttempts ?? 3
    }
    const sha = await GithubContentSource.resolveRef(config, resolved)
    resolved.logger.info(`Pinned ${config.repository.full}@${config.ref} to ${sha.slice(0, 7)}`)
    return new GithubContentSource(config, resolved, sha)
  }

  private static async resolveRef(
    config: GithubSourceConfig,
    deps: Required<GithubClientDeps>
  ): Promise<string> {
    const url = `${config.apiUrl}/repos/${config.repository.full}/commits/${encodeURIComponent(config.ref)}`
    const response = await requestWithRetry(url, config, deps, 'application/vnd.github.sha')
    if (response.status === 404) {
      throw new NotFoundError(config.repository.full, `ref ${config.ref}`, config.ref)
    }
    throwForStatus(response, config, `ref ${config.ref}`)
    const sha = (await response.text()).trim()
    if (!/^[0-9a-f]{40}$/i.test(sha)) {
      throw new TransportError(
        config.repository.full,
        `the commit endpoint did not return a SHA for ref ${config.ref}.`
      )
    }
    return sha.toLowerCase()
  }

  async read(path: string): Promise<Uint8Array | null> {
    const safePath = normalizeRepoPathOrThrow(path)
    const url = `${this.config.apiUrl}/repos/${this.config.repository.full}/contents/${encodeRepoPath(
      safePath
    )}?ref=${this.revision.commitSha}`
    const response = await requestWithRetry(
      url,
      this.config,
      this.deps,
      'application/vnd.github.raw'
    )
    if (response.status === 404) return null
    throwForStatus(response, this.config, safePath)

    // A directory answers with JSON even under the raw media type.
    if (response.headers.get('content-type')?.includes('application/json')) return null
    return new Uint8Array(await response.arrayBuffer())
  }

  async readText(path: string): Promise<string | null> {
    const bytes = await this.read(path)
    return bytes === null ? null : new TextDecoder('utf-8').decode(bytes)
  }

  fileUrl(path: string): string | undefined {
    const safePath = normalizeRepoPathOrThrow(path)
    return `https://github.com/${this.config.repository.full}/blob/${this.revision.commitSha}/${encodeRepoPath(safePath)}`
  }
}

function throwForStatus(response: Response, config: GithubSourceConfig, what: string): void {
  if (response.ok) return
  if (response.status === 401) throw new AuthenticationError(config.repository.full)
  if (response.status === 403 || response.status === 429) {
    if (isRateLimited(response)) {
      throw new RateLimitError(config.repository.full, parseResetHeader(response))
    }
    throw new PermissionError(config.repository.full, what)
  }
  if (response.status === 404) throw new NotFoundError(config.repository.full, what, config.ref)
  throw new TransportError(
    config.repository.full,
    `${response.status} ${response.statusText} while reading ${what}.`
  )
}

/**
 * Retries only what is worth retrying. A 401 or a 403 will answer the same way
 * for every attempt, so hammering the API with a bad token is pointless and
 * counts against the limit.
 */
async function requestWithRetry(
  url: string,
  config: GithubSourceConfig,
  deps: Required<GithubClientDeps>,
  accept: string
): Promise<Response> {
  let lastTransportDetail = 'unknown error'

  for (let attempt = 1; attempt <= deps.maxAttempts; attempt += 1) {
    let response: Response
    try {
      response = await deps.fetch(url, {
        headers: {
          accept,
          authorization: `Bearer ${config.token}`,
          'user-agent': USER_AGENT,
          'x-github-api-version': '2022-11-28'
        }
      })
    } catch (error) {
      lastTransportDetail = error instanceof Error ? error.message : String(error)
      if (attempt === deps.maxAttempts) break
      await deps.sleep(backoffMs(attempt))
      continue
    }

    const retryable = RETRYABLE_STATUS.has(response.status) && !isRateLimited(response)
    if (!retryable || attempt === deps.maxAttempts) return response

    const retryAfter = Number(response.headers.get('retry-after'))
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt)
    deps.logger.warn(`GitHub answered ${response.status}; retrying in ${Math.round(delay)}ms.`)
    await deps.sleep(delay)
  }

  throw new TransportError(config.repository.full, lastTransportDetail)
}

function backoffMs(attempt: number): number {
  return 400 * 2 ** (attempt - 1) + Math.random() * 200
}
