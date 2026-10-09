export const SAMPLE = [
  '@[TOC](这里写自定义目录标题)',
  '',
  '# EditorX Markdown 引擎演示',
  '',
  '这是 **ClEditEngine** 的演示，支持 *斜体*、~~删除线~~、==高亮== 与 `行内代码`。',
  '参考 [CSDN][csdn] 与 [StackEdit][1] 的写作体验，这里有一个脚注[^1]。',
  '',
  '[csdn]: https://www.csdn.net',
  '[1]: https://stackedit.io',
  '',
  '## 列表',
  '',
  '- 无序列表',
  '- [x] 已完成任务',
  '- [ ] 未完成任务',
  '',
  '1. 第一步',
  '2. 第二步',
  '',
  '## 代码',
  '',
  '```ts',
  'export function add(a: number, b: number): number {',
  '  return a + b',
  '}',
  '```',
  '',
  '## 公式',
  '',
  '行内公式 $E = mc^2$，块级公式：',
  '',
  '$$',
  '\\int_0^1 x^2 \\, dx = \\frac{1}{3}',
  '$$',
  '',
  '## 图表',
  '',
  '```mermaid',
  'graph LR',
  '  A[编辑] --> B[渲染]',
  '  B --> C[预览]',
  '```',
  '',
  '## 流程图',
  '',
  '```mermaid',
  'flowchart',
  'st=>start: 开始',
  'e=>end: 结束',
  'op=>operation: 我的操作',
  'cond=>condition: 确认？',
  '',
  'st->op->cond',
  'cond(yes)->e',
  'cond(no)->op',
  '```',
  '',
  '## 表格与引用',
  '',
  '| 功能 | 状态 |',
  '| --- | --- |',
  '| 高亮 | 完成 |',
  '| 同步滚动 | 完成 |',
  '',
  '> 引用：写作从这里开始，这是第二个脚注[^2]。',
  '',
  '[^1]: 第一个脚注的内容。',
  '[^2]: 第二个脚注的内容。',
  '',
].join('\n')

const ROWS_PER_SECTION = 45
const FOOTNOTE_EVERY = 40

/**
 * Every section is 50 lines and carries its own reference definition (and every 40th a footnote), so cutting
 * at a section boundary never leaves a dangling reference.
 */
export function generateLargeDoc(lineCount: number): string {
  const lines: string[] = []
  for (let section = 1; lines.length < lineCount; section++) {
    const footnote = section % FOOTNOTE_EVERY === 1
    lines.push(`## 第 ${section} 节`, '')
    for (let row = 1; row <= ROWS_PER_SECTION; row++) {
      const note = footnote && row === 1 ? `[^fn-${section}]` : ''
      lines.push(
        `第 ${section} 节第 ${row} 行：用于性能测试的 **Markdown** 文本，包含 \`code\` 与 [链接][ref-${section}]。${note}`,
      )
    }
    lines.push('', `[ref-${section}]: https://example.com/ref/${section}`, footnote ? `[^fn-${section}]: 第 ${section} 节的脚注。` : '')
  }
  return lines.slice(0, lineCount).join('\n')
}
