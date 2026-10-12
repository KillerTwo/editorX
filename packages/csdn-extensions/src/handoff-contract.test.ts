import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('阶段 8 交接', () => {
  it('笔记写明六个扩展、adapter 和嵌入属性，RESUME 把阶段 8 留在未开始', () => {
    const note = readFileSync(new URL('../../../docs/superpowers/handoff/phase8-notes-from-7.md', import.meta.url), 'utf8')
    const resume = readFileSync(new URL('../../../docs/superpowers/handoff/RESUME.md', import.meta.url), 'utf8')
    for (const phrase of [
      'csdnExtensions',
      'aiAssist',
      'createVote',
      'uploadVideo',
      'searchResources',
      'runCode',
      'getTemplates',
      'data-ex-payload',
      'data-payload',
      '模版',
      'extensions={[]}',
      '反馈',
      '历史',
      '待 Windows 复测',
      '未开始',
    ]) {
      expect(note).toContain(phrase)
    }
    expect(resume).toContain('phase8-notes-from-7.md')
    expect(resume).toMatch(/\| 7 \|[\s\S]*已完成/)
    expect(resume).toMatch(/\| 8 \|[\s\S]*未开始/)
    expect(resume).toContain('markdown-dialog-link-light-chromium-win32.png')
  })
})
