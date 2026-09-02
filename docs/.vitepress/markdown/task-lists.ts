import type { MarkdownRenderer } from 'vitepress'

/**
 * BMAD stories track work with `- [x]` / `- [ ]` checklists, and markdown-it
 * leaves those brackets as literal text. This turns them into a marked item:
 * a filled tick when done, a hatched square when not — Noir's texture for
 * "not yet real" — so the state never rests on colour alone.
 *
 * Nothing is written back to the source file; this is presentation only.
 */
export function taskLists(md: MarkdownRenderer): void {
  md.core.ruler.after('inline', 'bmad-task-lists', (state) => {
    const tokens = state.tokens
    for (let index = 2; index < tokens.length; index += 1) {
      const inline = tokens[index]
      const paragraph = tokens[index - 1]
      const listItem = tokens[index - 2]
      if (!inline || inline.type !== 'inline') continue
      if (!paragraph || paragraph.type !== 'paragraph_open') continue
      if (!listItem || listItem.type !== 'list_item_open') continue

      const match = /^\[([ xX])\][ \t]+/.exec(inline.content)
      if (!match) continue

      const done = (match[1] as string).toLowerCase() === 'x'
      inline.content = inline.content.slice(match[0].length)
      const first = inline.children?.[0]
      if (first && first.type === 'text') {
        first.content = first.content.replace(/^\[([ xX])\][ \t]+/, '')
      }

      const marker = new state.Token('html_inline', '', 0)
      marker.content =
        `<span class="bm-check${done ? ' is-done' : ''}" role="img" ` +
        `aria-label="${done ? 'Completed' : 'Not completed'}">${done ? '✓' : ''}</span>`
      inline.children?.unshift(marker)
      listItem.attrJoin('class', 'bm-task')
    }
    return true
  })
}
