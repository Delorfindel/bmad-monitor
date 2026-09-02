import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig, parseRepository, redactSecrets } from '../../src/config/env'

const GITHUB_ENV = {
  BMAD_REPOSITORY: 'acme/atlas',
  BMAD_REF: 'release',
  BMAD_SPRINT_STATUS: '_bmad-output/implementation-artifacts/sprint-6/sprint-status.yaml',
  GITHUB_TOKEN: 'github_pat_11ABCDEFG0123456789abcdefghij'
}

describe('loadConfig in GitHub mode', () => {
  it('accepts a complete configuration', () => {
    const config = loadConfig({ ...GITHUB_ENV })
    expect(config.source).toMatchObject({
      mode: 'github',
      ref: 'release',
      apiUrl: 'https://api.github.com'
    })
    expect(config.sprintStatusPath).toBe(GITHUB_ENV.BMAD_SPRINT_STATUS)
  })

  it('defaults the ref to main', () => {
    expect(loadConfig({ ...GITHUB_ENV, BMAD_REF: undefined }).source).toMatchObject({ ref: 'main' })
  })

  it.each([
    ['BMAD_SPRINT_STATUS', { ...GITHUB_ENV, BMAD_SPRINT_STATUS: undefined }],
    ['BMAD_REPOSITORY', { ...GITHUB_ENV, BMAD_REPOSITORY: undefined }],
    ['GITHUB_TOKEN', { ...GITHUB_ENV, GITHUB_TOKEN: undefined }]
  ])('requires %s', (name, env) => {
    expect(() => loadConfig(env)).toThrow(new RegExp(name))
  })

  it('rejects a malformed repository', () => {
    expect(() => loadConfig({ ...GITHUB_ENV, BMAD_REPOSITORY: 'not-a-repo' })).toThrow(ConfigError)
  })

  it('rejects a sprint status path that escapes the repository', () => {
    expect(() => loadConfig({ ...GITHUB_ENV, BMAD_SPRINT_STATUS: '../../etc/passwd' })).toThrow(
      /repository-relative/
    )
  })

  it('rejects a non-http API URL', () => {
    expect(() => loadConfig({ ...GITHUB_ENV, GITHUB_API_URL: 'ftp://x' })).toThrow(/http/)
  })

  it('never echoes the token in an error message', () => {
    try {
      loadConfig({ ...GITHUB_ENV, BMAD_REPOSITORY: 'bad repo' })
      throw new Error('expected a ConfigError')
    } catch (error) {
      expect((error as Error).message).not.toContain(GITHUB_ENV.GITHUB_TOKEN)
    }
  })

  it('keeps clean URLs unless the host is told not to', () => {
    expect(loadConfig({ ...GITHUB_ENV }).cleanUrls).toBe(true)
    expect(loadConfig({ ...GITHUB_ENV, BMAD_CLEAN_URLS: 'false' }).cleanUrls).toBe(false)
    expect(loadConfig({ ...GITHUB_ENV, BMAD_CLEAN_URLS: 'true' }).cleanUrls).toBe(true)
  })

  it('validates optional numeric tuning', () => {
    expect(() => loadConfig({ ...GITHUB_ENV, BMAD_CONCURRENCY: '0' })).toThrow(/positive integer/)
    expect(loadConfig({ ...GITHUB_ENV, BMAD_CONCURRENCY: '3' }).concurrency).toBe(3)
  })
})

describe('loadConfig in fixture mode', () => {
  it('needs no token and resolves the root', () => {
    const config = loadConfig({
      BMAD_LOCAL_SOURCE: 'fixtures/sample-project',
      BMAD_SPRINT_STATUS: '_bmad-output/implementation-artifacts/sprint-12/sprint-status.yaml'
    })
    expect(config.source).toMatchObject({
      mode: 'local',
      root: path.resolve('fixtures/sample-project')
    })
  })

  it('rejects a directory that does not exist', () => {
    expect(() =>
      loadConfig({ BMAD_LOCAL_SOURCE: 'fixtures/nope', BMAD_SPRINT_STATUS: 'a/b.yaml' })
    ).toThrow(/not a directory/)
  })
})

describe('helpers', () => {
  it('parses owner/name', () => {
    expect(parseRepository(' acme/atlas ')).toEqual({
      owner: 'acme',
      name: 'atlas',
      full: 'acme/atlas'
    })
  })

  it('redacts token-shaped values', () => {
    expect(redactSecrets(`failed with ${GITHUB_ENV.GITHUB_TOKEN}`)).toBe(
      'failed with [redacted-token]'
    )
    expect(redactSecrets('failed with ghp_0123456789abcdefghij')).toContain('[redacted-token]')
  })
})
