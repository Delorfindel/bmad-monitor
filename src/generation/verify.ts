import fs from 'node:fs/promises'
import path from 'node:path'

const TOKEN_SHAPES = [/gh[pousr]_[A-Za-z0-9_]{16,}/, /github_pat_[A-Za-z0-9_]{20,}/]
const TEXT_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.txt', '.js', '.ts', '.css', '.html'])

export interface SecretFinding {
  file: string
  reason: string
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

/**
 * Last line of defence before the generated tree is handed to VitePress: the
 * build token must never end up in a file that ships to the browser.
 */
export async function findSecrets(dir: string, token?: string): Promise<SecretFinding[]> {
  const findings: SecretFinding[] = []
  for await (const file of walk(dir)) {
    if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue
    const content = await fs.readFile(file, 'utf8')
    if (token !== undefined && token.length >= 8 && content.includes(token)) {
      findings.push({ file, reason: 'contains the configured GITHUB_TOKEN' })
      continue
    }
    const shape = TOKEN_SHAPES.find((pattern) => pattern.test(content))
    if (shape) findings.push({ file, reason: 'contains a value shaped like a GitHub token' })
  }
  return findings
}

export async function assertNoSecrets(dir: string, token?: string): Promise<void> {
  const findings = await findSecrets(dir, token)
  if (findings.length === 0) return
  const list = findings.map((finding) => `  - ${finding.file}: ${finding.reason}`).join('\n')
  throw new Error(`Refusing to continue: generated output would leak a credential.\n${list}`)
}
