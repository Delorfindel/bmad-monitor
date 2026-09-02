import { describe, expect, it, vi } from 'vitest'
import type { GithubSourceConfig } from '../../src/config/env'
import { GithubContentSource } from '../../src/github/client'
import {
  AuthenticationError,
  NotFoundError,
  PermissionError,
  RateLimitError,
  TransportError
} from '../../src/github/errors'

const SHA = 'b'.repeat(40)
const TOKEN = 'github_pat_11SECRETSECRETSECRETSECRET'

const CONFIG: GithubSourceConfig = {
  mode: 'github',
  repository: { owner: 'acme', name: 'atlas', full: 'acme/atlas' },
  ref: 'main',
  token: TOKEN,
  apiUrl: 'https://api.github.com'
}

function response(
  body: string,
  init: { status?: number; headers?: Record<string, string> } = {}
): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { 'content-type': 'text/plain', ...(init.headers ?? {}) }
  })
}

interface Call {
  url: string
  accept: string
  authorization: string
}

function recorder(handler: (call: Call) => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = []
  const fetchLike = (async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    const call = {
      url,
      accept: headers.accept ?? '',
      authorization: headers.authorization ?? ''
    }
    calls.push(call)
    return handler(call)
  }) as unknown as typeof fetch
  return { fetch: fetchLike, calls }
}

const deps = (fetchLike: typeof fetch, maxAttempts = 3) => ({
  fetch: fetchLike as never,
  sleep: async () => {},
  maxAttempts
})

describe('GithubContentSource snapshot consistency', () => {
  it('resolves the ref once and pins every later read to that SHA', async () => {
    const { fetch: fetchLike, calls } = recorder((call) =>
      call.url.includes('/commits/') ? response(SHA) : response('file body')
    )
    const source = await GithubContentSource.create(CONFIG, deps(fetchLike))

    await source.readText('a.md')
    await source.readText('b/c.md')

    expect(source.revision.commitSha).toBe(SHA)
    expect(source.revision.shortSha).toBe(SHA.slice(0, 7))
    const contentCalls = calls.filter((call) => call.url.includes('/contents/'))
    expect(contentCalls).toHaveLength(2)
    for (const call of contentCalls) expect(call.url).toContain(`?ref=${SHA}`)
    // The branch name is never used to fetch content.
    expect(contentCalls.some((call) => call.url.includes('ref=main'))).toBe(false)
  })

  it('builds blob URLs on the pinned SHA, not on the branch', async () => {
    const { fetch: fetchLike } = recorder(() => response(SHA))
    const source = await GithubContentSource.create(CONFIG, deps(fetchLike))
    expect(source.fileUrl('a/b c.md')).toBe(
      `https://github.com/acme/atlas/blob/${SHA}/a/b%20c.md`
    )
  })

  it('sends the token as a bearer header and never in the URL', async () => {
    const { fetch: fetchLike, calls } = recorder((call) =>
      call.url.includes('/commits/') ? response(SHA) : response('x')
    )
    const source = await GithubContentSource.create(CONFIG, deps(fetchLike))
    await source.readText('a.md')
    expect(calls.every((call) => call.authorization === `Bearer ${TOKEN}`)).toBe(true)
    expect(calls.every((call) => !call.url.includes(TOKEN))).toBe(true)
  })

  it('refuses a path that escapes the repository', async () => {
    const { fetch: fetchLike } = recorder(() => response(SHA))
    const source = await GithubContentSource.create(CONFIG, deps(fetchLike))
    await expect(source.readText('../../etc/passwd')).rejects.toThrow(/Rejected path/)
  })
})

describe('GithubContentSource error handling', () => {
  const withCommit = (handler: (call: Call) => Response) =>
    recorder((call) => (call.url.includes('/commits/') ? response(SHA) : handler(call)))

  it('returns null for a missing file instead of failing the build', async () => {
    const { fetch: fetchLike } = withCommit(() => response('', { status: 404 }))
    const source = await GithubContentSource.create(CONFIG, deps(fetchLike))
    expect(await source.readText('missing.md')).toBeNull()
  })

  it('reports a missing ref as a not-found error', async () => {
    const { fetch: fetchLike } = recorder(() => response('', { status: 404 }))
    await expect(GithubContentSource.create(CONFIG, deps(fetchLike))).rejects.toThrow(NotFoundError)
  })

  it('reports 401 as an authentication error and does not retry it', async () => {
    const { fetch: fetchLike, calls } = recorder(() => response('', { status: 401 }))
    await expect(GithubContentSource.create(CONFIG, deps(fetchLike))).rejects.toThrow(
      AuthenticationError
    )
    expect(calls).toHaveLength(1)
  })

  it('separates a permission failure from a rate limit', async () => {
    const forbidden = withCommit(() => response('', { status: 403 }))
    const source = await GithubContentSource.create(CONFIG, deps(forbidden.fetch))
    await expect(source.readText('a.md')).rejects.toThrow(PermissionError)

    const limited = withCommit(() =>
      response('', {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' }
      })
    )
    const limitedSource = await GithubContentSource.create(CONFIG, deps(limited.fetch))
    await expect(limitedSource.readText('a.md')).rejects.toThrow(RateLimitError)
  })

  it('does not retry a rate-limited response', async () => {
    const { fetch: fetchLike, calls } = withCommit(() =>
      response('', { status: 429, headers: { 'x-ratelimit-remaining': '0' } })
    )
    const source = await GithubContentSource.create(CONFIG, deps(fetchLike))
    await expect(source.readText('a.md')).rejects.toThrow(RateLimitError)
    expect(calls.filter((call) => call.url.includes('/contents/'))).toHaveLength(1)
  })

  it('retries a transient 503 and succeeds', async () => {
    let attempts = 0
    const { fetch: fetchLike } = withCommit(() => {
      attempts += 1
      return attempts < 3 ? response('', { status: 503 }) : response('recovered')
    })
    const source = await GithubContentSource.create(CONFIG, deps(fetchLike))
    expect(await source.readText('a.md')).toBe('recovered')
    expect(attempts).toBe(3)
  })

  it('retries a network failure and then gives up with a transport error', async () => {
    let attempts = 0
    const fetchLike = (async (url: string) => {
      if (String(url).includes('/commits/')) return response(SHA)
      attempts += 1
      throw new Error('socket hang up')
    }) as unknown as typeof fetch
    const source = await GithubContentSource.create(CONFIG, deps(fetchLike))
    await expect(source.readText('a.md')).rejects.toThrow(TransportError)
    expect(attempts).toBe(3)
  })

  it('treats a directory listing as no file', async () => {
    const { fetch: fetchLike } = withCommit(() =>
      new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    )
    const source = await GithubContentSource.create(CONFIG, deps(fetchLike))
    expect(await source.readText('a-directory')).toBeNull()
  })

  it('rejects a commit endpoint that does not answer with a SHA', async () => {
    const { fetch: fetchLike } = recorder(() => response('not-a-sha'))
    await expect(GithubContentSource.create(CONFIG, deps(fetchLike))).rejects.toThrow(TransportError)
  })

  it('honours retry-after before a retry', async () => {
    const sleep = vi.fn(async () => {})
    let attempts = 0
    const { fetch: fetchLike } = recorder((call) => {
      if (call.url.includes('/commits/')) return response(SHA)
      attempts += 1
      return attempts === 1
        ? response('', { status: 503, headers: { 'retry-after': '2' } })
        : response('ok')
    })
    const source = await GithubContentSource.create(CONFIG, {
      fetch: fetchLike,
      sleep,
      maxAttempts: 3
    })
    await source.readText('a.md')
    expect(sleep).toHaveBeenCalledWith(2000)
  })
})
