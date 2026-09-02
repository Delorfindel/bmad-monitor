import type { DefaultTheme } from 'vitepress'
import type { SprintDashboardData } from '../../src/bmad/types'
import type { SequenceEntry } from '../../src/generation/navigation'

/**
 * The generated sprint model travels in `themeConfig`, so the browser never
 * fetches anything: the site is a static snapshot of one commit.
 */
export interface BmadThemeConfig extends DefaultTheme.Config {
  sprint: SprintDashboardData
  sequence: SequenceEntry[]
}
