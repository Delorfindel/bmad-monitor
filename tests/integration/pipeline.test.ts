import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/config/env'
import { collectSprint } from '../../src/generation/collect'
import { generateSite, type GenerationResult } from '../../src/generation/pages'
import { findSecrets } from '../../src/generation/verify'
import { createContentSource } from '../../src/github/index'
import type { CollectedSprint } from '../../src/generation/collect'

const run = promisify(execFile)
const repoRoot = path.resolve(__dirname, '../..')

const ENV = {
  BMAD_LOCAL_SOURCE: 'fixtures/sample-project',
  BMAD_SPRINT_STATUS: '_bmad-output/implementation-artifacts/sprint-12/sprint-status.yaml'
}

let outputDir: string
let collected: CollectedSprint
let generated: GenerationResult
let distDir: string

/**
 * The contract of the whole pipeline: a BMAD fixture, synchronised, modelled,
 * turned into pages, and built by VitePress without a single dead link.
 */
beforeAll(async () => {
  // The generated tree must live inside the project: Vite resolves `vue` and
  // its friends from the site directory, and node_modules is here.
  outputDir = path.join(repoRoot, '.generated-e2e')
  await fs.rm(outputDir, { recursive: true, force: true })
  const config = loadConfig({ ...ENV, BMAD_OUTPUT_DIR: outputDir }, repoRoot)
  const source = await createContentSource(config)
  collected = await collectSprint(config, source)
  generated = await generateSite(collected, config, source)

  await run('node', ['node_modules/vitepress/bin/vitepress.js', 'build', 'docs'], {
    cwd: repoRoot,
    env: { ...process.env, ...ENV, BMAD_OUTPUT_DIR: outputDir },
    maxBuffer: 32 * 1024 * 1024
  })
  distDir = path.join(repoRoot, 'docs/.vitepress/dist')
}, 300_000)

afterAll(async () => {
  await fs.rm(outputDir, { recursive: true, force: true })
})

describe('fixture → sync → model → pages → VitePress build', () => {
  it('models the whole sprint scope, every status included', () => {
    const { data } = collected
    expect(data.project).toBe('Atlas Portal')
    expect(data.sprintLabel).toBe('Sprint 12')
    expect(data.epics.map((epic) => epic.number)).toEqual([12, 13, 14])
    expect(data.totalStories).toBe(9)
    expect(data.progress).toEqual({
      done: 2,
      review: 2,
      'in-progress': 1,
      'ready-for-dev': 1,
      backlog: 3
    })
  })

  it('surfaces the sprint pause and hides the generic BMAD definitions', () => {
    expect(collected.data.contextBlocks).toHaveLength(1)
    expect(collected.data.contextBlocks[0]?.tone).toBe('paused')
    expect(collected.data.contextBlocks[0]?.title).toContain('TILE INGEST IS PAUSED')
  })

  it('reports the story with no Markdown file without failing the build', () => {
    expect(collected.data.warnings.map((warning) => warning.code)).toContain('missing-story-file')
  })

  it('generates one page per route', () => {
    expect(generated.pages).toContain('index.md')
    expect(generated.pages).toContain('epics/12.md')
    expect(generated.pages).toContain('stories/12-3-bound-tile-prefetch-and-retries.md')
    expect(generated.pages).toContain('context/tile-ingest-pause-2026-03-04.md')
  })

  it('produces the static site VitePress is asked to build', async () => {
    for (const file of [
      'index.html',
      'epics/12.html',
      'stories/12-1-define-tile-cache-contract.html',
      'context/tile-ingest-pause-2026-03-04.html'
    ]) {
      await expect(fs.stat(path.join(distDir, file))).resolves.toBeTruthy()
    }
  })

  it('renders the dashboard into the HTML rather than fetching at runtime', async () => {
    const html = await fs.readFile(path.join(distDir, 'index.html'), 'utf8')
    expect(html).toContain('Atlas Portal')
    expect(html).toContain('TILE INGEST IS PAUSED')
    expect(html).toContain('Trusted Vector Tile Delivery')
    // Every status is written out as a word, never carried by colour alone.
    for (const label of ['Done', 'In review', 'In progress', 'Ready for dev', 'Backlog']) {
      expect(html).toContain(label)
    }
  })

  it('copies referenced images into the site instead of linking a private raw URL', async () => {
    expect(generated.assets).toHaveLength(1)
    await expect(
      fs.stat(path.join(distDir, generated.assets[0]?.slice(1) as string))
    ).resolves.toBeTruthy()
    const html = await fs.readFile(
      path.join(distDir, 'stories/12-4-expose-cache-metrics-to-the-operator-console.html'),
      'utf8'
    )
    expect(html).not.toContain('raw.githubusercontent.com')
  })

  it('renders Mermaid, tables and checklists on the story pages', async () => {
    const html = await fs.readFile(
      path.join(distDir, 'stories/12-2-stream-vector-tiles-from-object-storage.html'),
      'utf8'
    )
    expect(html).toContain('bm-mermaid')
    const contract = await fs.readFile(
      path.join(distDir, 'stories/12-1-define-tile-cache-contract.html'),
      'utf8'
    )
    expect(contract).toContain('<table')
    expect(contract).toContain('bm-check is-done')
  })

  it('indexes only this sprint in the local search', async () => {
    const chunks = await fs.readdir(path.join(distDir, 'assets/chunks'))
    const searchIndex = chunks.filter((name) => name.startsWith('@localSearchIndex'))
    expect(searchIndex.length).toBeGreaterThan(0)
    const content = await fs.readFile(
      path.join(distDir, 'assets/chunks', searchIndex[0] as string),
      'utf8'
    )
    expect(content).toContain('Tile Cache Contract')
    expect(content).not.toContain('sprint-11')
  })

  it('ships no credential in the generated tree or in the built site', async () => {
    expect(await findSecrets(outputDir)).toEqual([])
    expect(await findSecrets(distDir)).toEqual([])
  })
})
