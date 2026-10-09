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
    expect(stats!.mdWords).toBeGreaterThan(0)
    expect(stats!.paragraphs).toBeGreaterThanOrEqual(2)
    expect(counter.count(sections, () => false)).toEqual(stats)
  })
})
