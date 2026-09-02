import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import DocFooterNav from './components/DocFooterNav.vue'
import DocHeader from './components/DocHeader.vue'
import EpicStoryList from './components/EpicStoryList.vue'
import SprintDashboard from './components/SprintDashboard.vue'
import './noir.css'
import './styles.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'doc-before': () => h(DocHeader),
      'doc-after': () => h(DocFooterNav)
    }),
  enhanceApp({ app }) {
    // Used from generated Markdown pages.
    app.component('SprintDashboard', SprintDashboard)
    app.component('EpicStoryList', EpicStoryList)
  }
} satisfies Theme
