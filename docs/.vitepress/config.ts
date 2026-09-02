import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfigWithTheme, type DefaultTheme } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
// Types only: this file is bundled by esbuild, which erases type-only imports.
import type { SprintDashboardData } from '../../src/bmad/types'
import type { ThemeNavigation } from '../../src/generation/navigation'
import { taskLists } from './markdown/task-lists'
import type { BmadThemeConfig } from './theme-config'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, '../..')
const outputDir = path.resolve(projectRoot, process.env.BMAD_OUTPUT_DIR ?? '.generated')

function readGenerated<T>(name: string): T {
  const file = path.join(outputDir, 'data', name)
  if (!fs.existsSync(file)) {
    throw new Error(
      `${file} is missing. Run \`npm run sync-content\` before building; the site is generated from the sprint snapshot, not committed.`
    )
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

const sprint = readGenerated<SprintDashboardData>('dashboard.json')
const navigation = readGenerated<ThemeNavigation>('navigation.json')

const title =
  process.env.BMAD_SITE_TITLE?.trim() ||
  (sprint.sprintLabel ? `${sprint.project} — ${sprint.sprintLabel}` : sprint.project)

// The site title already links to the dashboard, so the nav only carries what
// leads somewhere else.
const nav: DefaultTheme.NavItem[] = sprint.sprintStatusUrl
  ? [{ text: 'Sprint status on GitHub', link: sprint.sprintStatusUrl }]
  : []

export default withMermaid(
  defineConfigWithTheme<BmadThemeConfig>({
    srcDir: path.join(outputDir, 'site'),
    outDir: path.join(here, 'dist'),
    cacheDir: path.join(here, 'cache'),
    title,
    description: sprint.scope ?? `BMAD sprint portal for ${sprint.project}`,
    lang: 'en',
    cleanUrls: true,
    lastUpdated: false,
    // Internal links are generated from the sprint model, so a dead one is a bug.
    ignoreDeadLinks: false,
    head: [
      ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
      ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
      [
        'link',
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Poppins:wght@200;300;400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'
        }
      ],
      ['meta', { name: 'robots', content: 'noindex, nofollow' }]
    ],
    markdown: {
      config: (md) => {
        md.use(taskLists)
      }
    },
    themeConfig: {
      // Consumed by the theme components; contains no credential.
      sprint,
      sequence: navigation.sequence,
      nav: nav.length > 0 ? nav : undefined,
      sidebar: navigation.sidebar,
      outline: { level: [2, 3], label: 'On this page' },
      search: { provider: 'local' },
      docFooter: { prev: false, next: false },
      externalLinkIcon: true
    },
    vite: {
      server: {
        // srcDir and the parsing modules both live outside the VitePress root.
        fs: { allow: [projectRoot] }
      },
      // Mermaid pulls in CommonJS dependencies. The production build lets
      // Rollup handle the interop; the dev server needs them pre-bundled, or
      // they are served raw and their default export goes missing.
      optimizeDeps: { include: ['mermaid', 'fastdom', 'dayjs', 'cytoscape'] },
      ssr: { noExternal: ['mermaid'] },
      build: {
        // The only chunks over Rollup's 500 kB default are Mermaid's own
        // per-diagram bundles (cytoscape, katex, the architecture and sequence
        // renderers). Mermaid loads each on demand, so none of them is in the
        // critical path and the default warning is noise here.
        chunkSizeWarningLimit: 1000
      }
    },
    // The plugin forces the `dark` theme when VitePress is dark; this is the
    // light-mode counterpart.
    mermaid: { theme: 'neutral', securityLevel: 'strict', fontFamily: 'inherit' },
    mermaidPlugin: { class: 'bm-mermaid' }
  })
)
