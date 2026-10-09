// Portions adapted from StackEdit (https://github.com/benweet/stackedit), Apache-2.0.
import type { MarkdownIt } from 'markdown-it'

const TASK_MARKER = /^\[([ xX])\][ \t]/

export function taskListsPlugin(md: MarkdownIt): void {
  md.core.ruler.after('text_join', 'ex_task_lists', (state) => {
    const tokens = state.tokens
    for (let i = 2; i < tokens.length; i++) {
      const inline = tokens[i]!
      const item = tokens[i - 2]!
      if (inline.type !== 'inline' || tokens[i - 1]!.type !== 'paragraph_open' || item.type !== 'list_item_open') {
        continue
      }
      const match = TASK_MARKER.exec(inline.content)
      const first = inline.children?.[0]
      if (!match || !first || first.type !== 'text' || !first.content.startsWith(match[0])) continue

      first.content = first.content.slice(match[0].length)
      inline.content = inline.content.slice(match[0].length)
      const checkbox = new state.Token('html_inline', '', 0)
      const checked = match[1] === ' ' ? '' : ' checked'
      checkbox.content = `<input class="ex-task-list-item-checkbox" type="checkbox" disabled${checked}> `
      inline.children!.unshift(checkbox)
      item.attrJoin('class', 'ex-task-list-item')

      for (let j = i - 3; j >= 0; j--) {
        const list = tokens[j]!
        const isListOpen = list.type === 'bullet_list_open' || list.type === 'ordered_list_open'
        if (isListOpen && list.level === item.level - 1) {
          if (!String(list.attrGet('class') ?? '').includes('ex-task-list')) list.attrJoin('class', 'ex-task-list')
          break
        }
      }
    }
  })
}
