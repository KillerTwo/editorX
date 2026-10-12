import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('阶段 7 交接', () => {
  it('笔记写明顶栏、切换、备份和滚动，RESUME 指向该笔记', () => {
    const note = readFileSync(new URL('../../../docs/superpowers/handoff/phase7-notes-from-6.md', import.meta.url), 'utf8')
    const resume = readFileSync(new URL('../../../docs/superpowers/handoff/RESUME.md', import.meta.url), 'utf8')
    for (const phrase of [
      'G01',
      '56',
      'editorx-csdn-draft',
      'htmlToMarkdown',
      'autoSaveInterval',
      '.ex-rte__scroll',
      '.ex-rte-bar-host',
      'countRichTextChars',
      '阶段 7',
      '待 Windows 复测',
    ]) {
      expect(note).toContain(phrase)
    }
    expect(resume).toContain('phase7-notes-from-6.md')
    expect(resume).toMatch(/\| 6 \|[\s\S]*已完成/)
  })
})
