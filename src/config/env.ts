import fs from 'node:fs'
import path from 'node:path'
import { normalizeRepoPath } from '../shared/paths.js'

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export interface RepositoryRef {
  owner: string
  name: string
  /** `owner/name`. */
  full: string
}

export interface GithubSourceConfig {
  mode: 'github'
  repository: RepositoryRef
  ref: string
  token: string
  apiUrl: string
}

export interface LocalSourceConfig {
  mode: 'local'
  /** Absolute path to the directory that stands in for the repository root. */
  root: string
  label: string
}

export type SourceConfig = GithubSourceConfig | LocalSourceConfig

export interface AppConfig {
  source: SourceConfig
  sprintStatusPath: string
  /** Absolute path of the regenerable output directory. */
  outputDir: string
  siteTitle?: string
  /** `false` when the host does not serve `/a/b` from `a/b.html`. */
  cleanUrls: boolean
  maxLinkedDocuments: number
  maxAssets: number
  maxAssetBytes: number
  concurrency: number
}

const REPOSITORY_PATTERN = /^([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*)$/
const DEFAULT_API_URL = 'https://api.github.com'

export type EnvRecord = Record<string, string | undefined>

/**
 * Minimal `.env` reader for local development. It never overwrites a variable
 * that is already set, so Vercel's environment always wins in production.
 */
export function loadDotEnv(cwd: string, env: EnvRecord): void {
  const file = path.join(cwd, '.env')
  if (!fs.existsSync(file)) return
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue
    const key = match[1] as string
    if (env[key] !== undefined) continue
    let value = (match[2] as string).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
}

function required(env: EnvRecord, key: string, hint: string): string {
  const value = env[key]?.trim()
  if (value === undefined || value === '') {
    throw new ConfigError(`${key} is required. ${hint}`)
  }
  return value
}

function positiveInt(env: EnvRecord, key: string, fallback: number): number {
  const raw = env[key]?.trim()
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new ConfigError(`${key} must be a positive integer, received ${JSON.stringify(raw)}.`)
  }
  return value
}

export function parseRepository(value: string): RepositoryRef {
  const match = REPOSITORY_PATTERN.exec(value.trim())
  if (!match) {
    throw new ConfigError(
      `BMAD_REPOSITORY must look like "owner/repository", received ${JSON.stringify(value)}.`
    )
  }
  return { owner: match[1] as string, name: match[2] as string, full: `${match[1]}/${match[2]}` }
}

/**
 * Validates the whole deployment configuration up front. Error messages name
 * the variable at fault and never echo a token value.
 */
export function loadConfig(env: EnvRecord = process.env, cwd: string = process.cwd()): AppConfig {
  const rawSprintStatus = required(
    env,
    'BMAD_SPRINT_STATUS',
    'It is the repository-relative path of the sprint-status.yaml that defines this deployment.'
  )
  const sprintStatusPath = normalizeRepoPath(rawSprintStatus)
  if (sprintStatusPath === null) {
    throw new ConfigError(
      `BMAD_SPRINT_STATUS must be a repository-relative path without "..", received ${JSON.stringify(rawSprintStatus)}.`
    )
  }

  const localSource = env.BMAD_LOCAL_SOURCE?.trim()
  const shared = {
    sprintStatusPath,
    outputDir: path.resolve(cwd, env.BMAD_OUTPUT_DIR?.trim() || '.generated'),
    siteTitle: env.BMAD_SITE_TITLE?.trim() || undefined,
    cleanUrls: env.BMAD_CLEAN_URLS?.trim().toLowerCase() !== 'false',
    maxLinkedDocuments: positiveInt(env, 'BMAD_MAX_LINKED_DOCUMENTS', 40),
    maxAssets: positiveInt(env, 'BMAD_MAX_ASSETS', 60),
    maxAssetBytes: positiveInt(env, 'BMAD_MAX_ASSET_BYTES', 5 * 1024 * 1024),
    concurrency: positiveInt(env, 'BMAD_CONCURRENCY', 6)
  } satisfies Omit<AppConfig, 'source'>

  if (localSource !== undefined && localSource !== '') {
    const root = path.resolve(cwd, localSource)
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      throw new ConfigError(`BMAD_LOCAL_SOURCE points at ${localSource}, which is not a directory.`)
    }
    return {
      ...shared,
      source: { mode: 'local', root, label: localSource }
    }
  }

  const repository = parseRepository(
    required(
      env,
      'BMAD_REPOSITORY',
      'Set it to the monitored repository as "owner/name", or set BMAD_LOCAL_SOURCE to build from a local fixture.'
    )
  )
  const token = required(
    env,
    'GITHUB_TOKEN',
    'Use a fine-grained personal access token with only "Contents: Read-only" on that repository. It is read at build time and never shipped to the browser.'
  )
  const apiUrl = (env.GITHUB_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, '')
  if (!/^https?:\/\//.test(apiUrl)) {
    throw new ConfigError(`GITHUB_API_URL must be an http(s) URL, received ${JSON.stringify(apiUrl)}.`)
  }

  return {
    ...shared,
    source: {
      mode: 'github',
      repository,
      ref: env.BMAD_REF?.trim() || 'main',
      token,
      apiUrl
    }
  }
}

/** Redacts anything token-shaped before a value can reach a log or a file. */
export function redactSecrets(text: string): string {
  return text
    .replace(/gh[pousr]_[A-Za-z0-9_]{16,}/g, '[redacted-token]')
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, '[redacted-token]')
}
