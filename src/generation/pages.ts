import fs from 'node:fs/promises'
import path from 'node:path'
import { rewriteMarkdownLinks, scanMarkdown, type LinkDecision, type LinkRewrite } from '../bmad/markdown.js'
import { referenceCandidates } from '../bmad/references.js'
import { STATUS_LABELS, type SprintDashboardData } from '../bmad/types.js'
import type { AppConfig } from '../config/env.js'
import type { ContentSource } from '../github/types.js'
import { silentLogger, type Logger } from '../shared/logger.js'
import { isAnchorLink, isExternalLink, splitAnchor } from '../shared/paths.js'
import { yamlString } from '../shared/text.js'
import type { CollectedSprint } from './collect.js'
import { buildNavigation } from './navigation.js'
import { sanitizeForVue } from './markdown-safety.js'
import { assetPublicPath, contextPageFile, epicPageFile, storyPageFile } from './routes.js'

export interface GenerationResult {
  siteDir: string
  dataFile: string
  pages: string[]
  assets: string[]
}

interface LinkContext {
  fromPath: string
  routeByPath: Map<string, string>
  assets: Set<string>
  source: ContentSource
}

/**
 * Points a link found in a BMAD document at the right place: a generated page
 * when the document is part of this deployment, a local copy for an image, the
 * file on GitHub otherwise. A private repository's `raw.githubusercontent.com`
 * URL would need browser credentials, so it is never emitted.
 *
 * When nothing can be resolved and the source cannot build an external URL —
 * fixture mode — the link is degraded to plain text rather than left dangling,
 * because a dead internal link fails the VitePress build.
 */
function resolveLink(link: LinkRewrite, context: LinkContext): LinkDecision {
  const target = link.target
  if (target === '' || isExternalLink(target) || isAnchorLink(target)) return null
  const { path: rawPath, anchor } = splitAnchor(target)
  const candidates = referenceCandidates(rawPath, context.fromPath, 'link')
  if (candidates.length === 0) return null

  if (link.isImage) {
    const local = candidates.find((candidate) => context.assets.has(candidate))
    if (local !== undefined) return { target: assetPublicPath(local) }
  }

  const routed = candidates.find((candidate) => context.routeByPath.has(candidate))
  if (routed !== undefined) {
    return { target: `${context.routeByPath.get(routed) as string}${anchor}` }
  }

  const external = context.source.fileUrl(candidates[0] as string)
  if (external !== undefined) return { target: `${external}${anchor}` }

  return {
    replacement: link.isImage
      ? `\`${link.label || rawPath}\` (image not published: \`${rawPath}\`)`
      : `${link.label || rawPath} (\`${rawPath}\`)`
  }
}

const CODE_SPAN = /`([^`\n]+)`/g

/**
 * BMAD documents name other documents far more often in a backticked path than
 * in a Markdown link. Those paths are turned into links to the generated page
 * when there is one, keeping the code styling — the text the author wrote is
 * unchanged, it simply becomes navigable.
 */
function linkifyDocumentPaths(markdown: string, context: LinkContext): string {
  const { lines, fenced } = scanMarkdown(markdown)
  return lines
    .map((line, index) => {
      if (fenced[index]) return line
      return line.replace(CODE_SPAN, (whole, content: string, offset: number) => {
        // Never nest a link inside an existing link label or target.
        if (line[offset - 1] === '[' || line[offset - 1] === '(') return whole
        if (line[offset + whole.length] === ']') return whole
        const { path: rawPath, anchor } = splitAnchor(content.trim())
        if (!rawPath.toLowerCase().endsWith('.md')) return whole
        const candidates = referenceCandidates(rawPath, context.fromPath, 'bare')
        const routed = candidates.find((candidate) => context.routeByPath.has(candidate))
        if (routed === undefined) return whole
        return `[${whole}](${context.routeByPath.get(routed) as string}${anchor})`
      })
    })
    .join('\n')
}

function rewrite(markdown: string, context: LinkContext): string {
  return linkifyDocumentPaths(
    rewriteMarkdownLinks(markdown, (link) => resolveLink(link, context)),
    context
  )
}

function frontmatter(fields: Record<string, string | number | boolean | undefined>): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      typeof value === 'string' ? `${key}: ${yamlString(value)}` : `${key}: ${String(value)}`
    )
  return `---\n${lines.join('\n')}\n---\n`
}

async function writeFile(file: string, content: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, content)
}

/**
 * Writes the whole regenerable output tree. `.generated` is disposable by
 * design: it is never a source of authority and is recreated from scratch.
 */
export async function generateSite(
  collected: CollectedSprint,
  config: AppConfig,
  source: ContentSource,
  logger: Logger = silentLogger
): Promise<GenerationResult> {
  const siteDir = path.join(config.outputDir, 'site')
  const dataDir = path.join(config.outputDir, 'data')
  const rawDir = path.join(config.outputDir, 'raw')
  await fs.rm(config.outputDir, { recursive: true, force: true })

  const routeByPath = new Map<string, string>()
  for (const document of collected.stories) {
    if (document.story.sourcePath) routeByPath.set(document.story.sourcePath, document.story.route)
  }
  for (const document of collected.linkedDocuments) routeByPath.set(document.path, document.route)

  const assetPaths = new Set(collected.assets.keys())
  const pages: string[] = []
  const write = async (relative: string, body: string): Promise<void> => {
    await writeFile(path.join(siteDir, relative), body)
    pages.push(relative)
  }

  const { data } = collected

  // --- Dashboard ---------------------------------------------------------
  await write(
    'index.md',
    `${frontmatter({
      layout: 'page',
      title: data.sprintLabel ? `${data.project} — ${data.sprintLabel}` : data.project,
      description: data.scope,
      sidebar: false,
      aside: false,
      pageClass: 'bm-dashboard-page'
    })}\n<SprintDashboard />\n`
  )

  // --- Epics -------------------------------------------------------------
  for (const document of collected.epics) {
    const { epic, planning } = document
    const context: LinkContext = {
      fromPath: data.planningSource ?? data.sprintStatusPath,
      routeByPath,
      assets: assetPaths,
      source
    }
    const sections: string[] = [
      frontmatter({
        title: `Epic ${epic.number} — ${epic.title}`,
        description: `${epic.stories.length} stories · ${STATUS_LABELS[
          epic.status === 'in-progress' ? 'in-progress' : epic.status === 'done' ? 'done' : 'backlog'
        ]}`,
        bmadType: 'epic',
        bmadKey: String(epic.number),
        prev: false,
        next: false,
        outline: 'deep'
      }),
      `\n# Epic ${epic.number} — ${epic.title}\n`,
      '\n<EpicStoryList />\n'
    ]

    if (planning && planning.body.trim() !== '') {
      sections.push(`\n${sanitizeForVue(rewrite(planning.body, context))}\n`)
    } else {
      sections.push(
        `\n::: warning Planning section unavailable\nNo section for this epic could be extracted from \`${
          data.planningSource ?? 'the planning source'
        }\`. The story list above still reflects the sprint status.\n:::\n`
      )
    }
    await write(epicPageFile(epic.number), sections.join(''))
  }

  // --- Stories -----------------------------------------------------------
  for (const document of collected.stories) {
    const { story, markdown } = document
    const context: LinkContext = {
      fromPath: story.sourcePath ?? data.sprintStatusPath,
      routeByPath,
      assets: assetPaths,
      source
    }
    const head = frontmatter({
      title: `${story.label} — ${story.title}`,
      description: STATUS_LABELS[story.status],
      bmadType: 'story',
      bmadKey: story.key,
      prev: false,
      next: false,
      outline: 'deep'
    })
    const body =
      markdown === null
        ? `\n# ${story.label} — ${story.title}\n\n::: danger Story file not found\nNo Markdown file was found for this story at this revision${
            data.storyLocation ? ` (expected \`${data.storyLocation}/${story.key}.md\`)` : ''
          }. Its status below comes from the sprint status file, which is the authority on scope.\n:::\n`
        : `\n${sanitizeForVue(rewrite(markdown, context))}\n`
    await write(storyPageFile(story.key), `${head}${body}`)
  }

  // --- Linked documents --------------------------------------------------
  for (const document of collected.linkedDocuments) {
    const context: LinkContext = {
      fromPath: document.path,
      routeByPath,
      assets: assetPaths,
      source
    }
    await write(
      contextPageFile(document.slug),
      `${frontmatter({
        title: document.title,
        bmadType: 'context',
        bmadKey: document.slug,
        prev: false,
        next: false,
        outline: 'deep'
      })}\n${sanitizeForVue(rewrite(document.markdown, context))}\n`
    )
  }

  // --- Assets ------------------------------------------------------------
  const assets: string[] = []
  for (const [repoPath, bytes] of collected.assets) {
    const publicPath = assetPublicPath(repoPath)
    await writeFile(path.join(siteDir, 'public', publicPath.replace(/^\//, '')), bytes)
    assets.push(publicPath)
  }

  // --- Model and raw mirror ----------------------------------------------
  const dataFile = path.join(dataDir, 'dashboard.json')
  await writeFile(dataFile, `${JSON.stringify(data satisfies SprintDashboardData, null, 2)}\n`)
  await writeFile(
    path.join(dataDir, 'navigation.json'),
    `${JSON.stringify(buildNavigation(data), null, 2)}\n`
  )
  for (const [repoPath, text] of collected.rawTexts) {
    await writeFile(path.join(rawDir, repoPath), text)
  }

  logger.info(`Generated ${pages.length} pages and ${assets.length} assets.`)
  return { siteDir, dataFile, pages, assets }
}
