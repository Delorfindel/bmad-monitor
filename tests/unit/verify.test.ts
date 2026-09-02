import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertNoSecrets, findSecrets } from '../../src/generation/verify'

let dir: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bmad-verify-'))
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('findSecrets', () => {
  it('passes on clean output', async () => {
    await fs.writeFile(path.join(dir, 'page.md'), '# Clean\n')
    await expect(assertNoSecrets(dir, 'github_pat_11SECRET0123456789')).resolves.toBeUndefined()
  })

  it('detects the configured token verbatim', async () => {
    const token = 'github_pat_11SECRET0123456789'
    await fs.mkdir(path.join(dir, 'nested'), { recursive: true })
    await fs.writeFile(path.join(dir, 'nested', 'data.json'), `{"t":"${token}"}`)
    const findings = await findSecrets(dir, token)
    expect(findings).toHaveLength(1)
    expect(findings[0]?.reason).toContain('GITHUB_TOKEN')
  })

  it('detects a token-shaped value even without knowing the token', async () => {
    await fs.writeFile(path.join(dir, 'page.md'), 'ghp_0123456789abcdefghijklmno')
    expect(await findSecrets(dir)).toHaveLength(1)
  })

  it('fails loudly rather than shipping the leak', async () => {
    await fs.writeFile(path.join(dir, 'page.md'), 'github_pat_11SECRET0123456789abc')
    await expect(assertNoSecrets(dir)).rejects.toThrow(/leak a credential/)
  })
})
