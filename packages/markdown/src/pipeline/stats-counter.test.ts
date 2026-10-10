import { createRenderer } from '@editorx/markdown-core'
import { describe, expect, it } from 'vitest'
import { createStatsCounter } from './stats-counter'

describe('createStatsCounter', () => {
  it('按段累加的统计与整篇一致，时间不足返回 null 且保留已算缓存', () => {
    const { sections } = createRenderer().render('# 标题\n\n第一段 hello world\n\n## 二\n\n- a\n- b\n')
    const counter = createStatsCounter()
    let budget = 1
    expect(counter.count(sections, () => budget-- > 0)).toBeNull()
    const stats = counter.count(sections, () => true)
    expect(stats).toMatchObject({ lines: 9 })
    expect(stats!.mdChars).toBeGreaterThan(0)
    expect(stats!.paragraphs).toBeGreaterThanOrEqual(2)
    expect(counter.count(sections, () => false)).toEqual(stats)
  })

  it('计数规则（G18）：字数按非空白字符；行数末尾无换行时 +1；空文档 2 行', () => {
    const counter = createStatsCounter()
    const count = (md: string) => counter.count(createRenderer().render(md).sections, () => true)!
    expect(count('test')).toEqual({ mdChars: 4, lines: 2, htmlChars: 4, paragraphs: 1 })
    expect(count('')).toEqual({ mdChars: 0, lines: 2, htmlChars: 0, paragraphs: 0 })
    expect(count('a\nb')).toMatchObject({ lines: 3 })
    expect(count('a\nb\n')).toMatchObject({ lines: 3 })
    expect(count('# 标题\n\n正文 hello')).toMatchObject({ mdChars: 10, lines: 4 })
  })
})
