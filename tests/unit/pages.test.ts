import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collectSprint } from '../../src/generation/collect'
import { generateSite } from '../../src/generation/pages'
import { assetPublicPath } from '../../src/generation/routes'
import { findSecrets } from '../../src/generation/verify'
import { testConfig } from '../helpers/config'
import { FakeContentSource } from '../helpers/source'

const STATUS_PATH = 'sprint/sprint-status.yaml'
const SHA = 'a'.repeat(40)

const FILES: Record<string, string | Uint8Array> = {
  [STATUS_PATH]: [
    'project: Demo',
    'story_location: sprint/stories',
    'planning_source: docs/epics.md',
    '',
    'development_status:',
    '  epic-2: in-progress',
    '  2-1-alpha: review',
    '  2-2-beta: backlog',
    ''
  ].join('\n'),
  'docs/epics.md': '# Plan\n\n## Epic 2: Provider Integration\n\nGoal. See `docs/blocked.md`.\n',
  'docs/blocked.md': '# Blocked\n\nWaiting.\n',
  'sprint/stories/2-1-alpha.md': [
    '# Story 2.1: Alpha',
    '',
    'Deploy with {{ token }} and clone <owner>/<repo>.',
    '',
    'See [the block note](../../docs/blocked.md#waiting) and',
    '[the source](../../services/tiles/contract.ts).',
    '',
    '![shot](../../docs/shot.png)',
    '',
    'Related: `docs/blocked.md`.',
    ''
  ].join('\n'),
  'docs/shot.png': new Uint8Array([137, 80, 78, 71])
}

let outputDir: string

beforeEach(async () => {
  outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bmad-pages-'))
})

afterEach(async () => {
  await fs.rm(outputDir, { recursive: true, force: true })
})

async function build() {
  const config = testConfig({ sprintStatusPath: STATUS_PATH, outputDir })
  const source = new FakeContentSource(FILES, { commitSha: SHA })
  const collected = await collectSprint(config, source)
  const result = await generateSite(collected, config, source)
  const read = (relative: string) => fs.readFile(path.join(result.siteDir, relative), 'utf8')
  return { config, result, read }
}

describe('generateSite', () => {
  it('writes one page per route, plus the model and the navigation', async () => {
    const { result, config } = await build()
    expect(result.pages.sort()).toEqual([
      'context/blocked.md',
      'epics/2.md',
      'index.md',
      'stories/2-1-alpha.md',
      'stories/2-2-beta.md'
    ])
    await expect(fs.stat(path.join(config.outputDir, 'data', 'dashboard.json'))).resolves.toBeTruthy()
    await expect(
      fs.stat(path.join(config.outputDir, 'data', 'navigation.json'))
    ).resolves.toBeTruthy()
  })

  it('mounts the dashboard component at the root, full width', async () => {
    const { read } = await build()
    const index = await read('index.md')
    expect(index).toContain('layout: "page"')
    expect(index).toContain('sidebar: false')
    expect(index).toContain('<SprintDashboard />')
  })

  it('tags each page with what it is, so the theme needs no parsing', async () => {
    const { read } = await build()
    expect(await read('stories/2-1-alpha.md')).toContain('bmadType: "story"')
    expect(await read('epics/2.md')).toContain('bmadKey: "2"')
  })

  it('rewrites a link to a published document as an internal route, anchor included', async () => {
    const { read } = await build()
    expect(await read('stories/2-1-alpha.md')).toContain('[the block note](/context/blocked#waiting)')
  })

  it('turns a backticked path into a link without changing the text', async () => {
    const { read } = await build()
    expect(await read('stories/2-1-alpha.md')).toContain('[`docs/blocked.md`](/context/blocked)')
  })

  it('sends an unpublished file to GitHub at the pinned SHA', async () => {
    const { read } = await build()
    expect(await read('stories/2-1-alpha.md')).toContain(
      `[the source](https://github.com/acme/atlas/blob/${SHA}/services/tiles/contract.ts)`
    )
  })

  it('serves images from the site itself, never from raw.githubusercontent.com', async () => {
    const { read, result } = await build()
    const page = await read('stories/2-1-alpha.md')
    expect(page).toContain(`![shot](${assetPublicPath('docs/shot.png')})`)
    expect(page).not.toContain('raw.githubusercontent.com')
    await expect(
      fs.stat(path.join(result.siteDir, 'public', assetPublicPath('docs/shot.png').slice(1)))
    ).resolves.toBeTruthy()
  })

  it('neutralises text that VitePress would compile as Vue', async () => {
    const { read } = await build()
    const page = await read('stories/2-1-alpha.md')
    expect(page).toContain('&#123;&#123; token &#125;&#125;')
    expect(page).toContain('&lt;owner>/&lt;repo>')
  })

  it('states plainly when a story has no file rather than rendering an empty page', async () => {
    const { read } = await build()
    expect(await read('stories/2-2-beta.md')).toContain('Story file not found')
  })

  it('builds the epic page from the planning section and the sprint story list', async () => {
    const { read } = await build()
    const page = await read('epics/2.md')
    expect(page).toContain('# Epic 2 — Provider Integration')
    expect(page).toContain('<EpicStoryList />')
    expect(page).toContain('Goal.')
  })

  it('mirrors the downloaded sources under .generated/raw for auditing', async () => {
    const { config } = await build()
    await expect(
      fs.readFile(path.join(config.outputDir, 'raw', STATUS_PATH), 'utf8')
    ).resolves.toContain('development_status')
  })

  it('leaves no credential anywhere in the generated tree', async () => {
    const { config } = await build()
    expect(await findSecrets(config.outputDir, 'github_pat_11SECRET0123456789')).toEqual([])
  })

  it('carries the page extension in every route when the host needs it', async () => {
    const config = testConfig({ sprintStatusPath: STATUS_PATH, outputDir, cleanUrls: false })
    const source = new FakeContentSource(FILES, { commitSha: SHA })
    const collected = await collectSprint(config, source)
    const result = await generateSite(collected, config, source)

    expect(collected.data.epics[0]?.route).toBe('/epics/2.html')
    expect(collected.data.epics[0]?.stories[0]?.route).toBe('/stories/2-1-alpha.html')
    expect(collected.linkedDocuments[0]?.route).toBe('/context/blocked.html')
    // Links inside the documents follow the same shape.
    const page = await fs.readFile(path.join(result.siteDir, 'stories/2-1-alpha.md'), 'utf8')
    expect(page).toContain('[the block note](/context/blocked.html#waiting)')
    // The page files themselves are unaffected.
    expect(result.pages).toContain('stories/2-1-alpha.md')
  })

  it('regenerates the output directory from scratch', async () => {
    await fs.writeFile(path.join(outputDir, 'stale.md'), 'left over')
    const { config } = await build()
    await expect(fs.stat(path.join(config.outputDir, 'stale.md'))).rejects.toThrow()
  })
})
