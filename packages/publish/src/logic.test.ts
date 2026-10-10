import { zhCN, type EditorAdapters, type PublishSettings } from '@editorx/toolbar'
import { describe, expect, it } from 'vitest'
import { adapterState } from './adapter-state'
import { extractImages, extractSummary, htmlToText } from './extract'
import { formatScheduleTime, fromLocalInputValue, toLocalInputValue } from './schedule'
import {
  createSettings,
  DEFAULT_SETTINGS,
  normalizeCover,
  pickCover,
  placeCover,
  removeCover,
  setCoverMode,
  toPayload,
} from './settings'
import { countChars, firstError, sliceChars, validatePublish, type RuleContext } from './validate'

const NOW = new Date(2026, 9, 9, 12, 0).getTime()
const ctx = (extra: Partial<RuleContext> = {}): RuleContext => ({ messages: zhCN.publish, now: NOW, ...extra })
const valid = (patch: Partial<PublishSettings> = {}) => createSettings({ tags: ['React'], ...patch })
const HOUR = 3_600_000
const DAY = 24 * HOUR

describe('settings', () => {
  it('默认值与 CSDN 初始态一致', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      tags: [],
      cover: { mode: 'single', urls: [] },
      summary: '',
      categories: [],
      articleType: 'original',
      declaration: 'none',
      backupToGitCode: false,
      visibility: 'public',
      template: 'default',
      multiPlatform: false,
    })
  })

  it('createSettings 合并并复制数组，不共享引用', () => {
    const tags = ['a']
    const s = createSettings({ tags, visibility: 'fans' })
    expect(s.visibility).toBe('fans')
    expect(s.tags).toEqual(['a'])
    expect(s.tags).not.toBe(tags)
    expect(createSettings().tags).not.toBe(DEFAULT_SETTINGS.tags)
  })

  it('封面：容量、去重、切换模式、点选、上传槽位、删除', () => {
    expect(normalizeCover({ mode: 'single', urls: ['a', 'b'] })).toEqual({ mode: 'single', urls: ['a'] })
    expect(normalizeCover({ mode: 'triple', urls: ['a', 'a', 'b', 'c', 'd'] })).toEqual({ mode: 'triple', urls: ['a', 'b', 'c'] })
    expect(setCoverMode({ mode: 'triple', urls: ['a', 'b'] }, 'none')).toEqual({ mode: 'none', urls: [] })
    expect(pickCover({ mode: 'single', urls: ['a'] }, 'b')).toEqual({ mode: 'single', urls: ['b'] })
    expect(pickCover({ mode: 'single', urls: ['a'] }, 'a')).toEqual({ mode: 'single', urls: [] })
    expect(pickCover({ mode: 'triple', urls: ['a'] }, 'b')).toEqual({ mode: 'triple', urls: ['a', 'b'] })
    expect(pickCover({ mode: 'triple', urls: ['a', 'b', 'c'] }, 'd')).toEqual({ mode: 'triple', urls: ['a', 'b', 'c'] })
    expect(placeCover({ mode: 'triple', urls: ['a', 'b'] }, 1, 'x')).toEqual({ mode: 'triple', urls: ['a', 'x'] })
    expect(placeCover({ mode: 'triple', urls: ['a'] }, 2, 'x')).toEqual({ mode: 'triple', urls: ['a', 'x'] })
    expect(removeCover({ mode: 'triple', urls: ['a', 'b', 'c'] }, 1)).toEqual({ mode: 'triple', urls: ['a', 'c'] })
  })

  it('toPayload：合并文档与设置，原创时丢弃 sourceUrl', () => {
    const doc = { editorType: 'markdown' as const, title: '标题标题标题', markdown: 'm', html: '<p>h</p>' }
    expect(toPayload(doc, valid({ sourceUrl: 'https://a.com' }))).not.toHaveProperty('sourceUrl')
    const payload = toPayload(doc, valid({ articleType: 'reprint', sourceUrl: ' https://a.com ' }))
    expect(payload).toMatchObject({ title: '标题标题标题', html: '<p>h</p>', tags: ['React'], sourceUrl: 'https://a.com' })
  })
})

describe('validatePublish', () => {
  it('合法设置无错误；按码点计数', () => {
    expect(validatePublish(valid(), ctx({ title: '一篇合格的标题' }))).toEqual({})
    expect(countChars('😀ab')).toBe(3)
    expect(sliceChars('😀ab', 2)).toBe('😀a')
  })

  it('标签必填且不超过 7 个', () => {
    expect(validatePublish(createSettings(), ctx()).tags).toBe('请至少添加 1 个文章标签')
    const many = valid({ tags: ['1', '2', '3', '4', '5', '6', '7', '8'] })
    expect(validatePublish(many, ctx()).tags).toBe('最多添加 7 个文章标签')
  })

  it('摘要 ≤256 字；三图封面需 3 张', () => {
    expect(validatePublish(valid({ summary: '字'.repeat(256) }), ctx()).summary).toBeUndefined()
    expect(validatePublish(valid({ summary: '字'.repeat(257) }), ctx()).summary).toBe('摘要不能超过 256 个字')
    expect(validatePublish(valid({ cover: { mode: 'triple', urls: ['a'] } }), ctx()).cover).toBe('三图封面需要选择 3 张图片')
    expect(validatePublish(valid({ cover: { mode: 'single', urls: [] } }), ctx()).cover).toBeUndefined()
  })

  it('转载/翻译需要 http(s) 原文链接', () => {
    expect(validatePublish(valid({ articleType: 'reprint' }), ctx()).sourceUrl).toBe('转载或翻译文章请填写原文链接')
    expect(validatePublish(valid({ articleType: 'translated', sourceUrl: 'ftp://x' }), ctx()).sourceUrl).toBe(
      '原文链接需以 http:// 或 https:// 开头',
    )
    expect(validatePublish(valid({ articleType: 'reprint', sourceUrl: 'https://x.com/a' }), ctx()).sourceUrl).toBeUndefined()
  })

  it('定时时间：有效、晚于当前，且在 now+4h … now+7d 闭区间内（B34，文案 B27）', () => {
    const at = (ms: number) => valid({ scheduledAt: new Date(ms).toISOString() })
    const hint = '请选择当前时间后 4小时 至 7天 进行定时发布'
    expect(validatePublish(valid({ scheduledAt: 'abc' }), ctx()).scheduledAt).toBe('请选择有效的发布时间')
    expect(validatePublish(at(NOW), ctx()).scheduledAt).toBe('发布时间需晚于当前时间')
    expect(validatePublish(at(NOW + 60_000), ctx()).scheduledAt).toBe(hint)
    expect(validatePublish(at(NOW + 4 * HOUR - 1), ctx()).scheduledAt).toBe(hint)
    expect(validatePublish(at(NOW + 4 * HOUR), ctx()).scheduledAt).toBeUndefined()
    expect(validatePublish(at(NOW + 7 * DAY), ctx()).scheduledAt).toBeUndefined()
    expect(validatePublish(at(NOW + 7 * DAY + 1), ctx()).scheduledAt).toBe(hint)
  })

  it('scheduleRange 覆盖默认区间，错误文案随之变化', () => {
    const range = { minOffsetMs: 30 * 60_000, maxOffsetMs: DAY }
    const at = (ms: number) => valid({ scheduledAt: new Date(ms).toISOString() })
    expect(validatePublish(at(NOW + 60_000), ctx({ scheduleRange: range })).scheduledAt).toBe(
      '请选择当前时间后 30分钟 至 1天 进行定时发布',
    )
    expect(validatePublish(at(NOW + 30 * 60_000), ctx({ scheduleRange: range })).scheduledAt).toBeUndefined()
  })

  it('标题 5–100 字，仅在提供标题时校验', () => {
    expect(validatePublish(valid(), ctx()).title).toBeUndefined()
    expect(validatePublish(valid(), ctx({ title: '短标题' })).title).toBe('文章标题需为 5～100 个字')
    expect(validatePublish(valid(), ctx({ title: '字'.repeat(101) })).title).toBe('文章标题需为 5～100 个字')
  })

  it('rules：函数替换内置规则，false 关闭；firstError 按字段顺序', () => {
    const rules = { tags: false as const, summary: (s: PublishSettings) => (s.summary ? undefined : '摘要必填') }
    const errors = validatePublish(createSettings({ articleType: 'reprint' }), ctx({ title: '短' }), rules)
    expect(errors).toEqual({ title: '文章标题需为 5～100 个字', summary: '摘要必填', sourceUrl: '转载或翻译文章请填写原文链接' })
    expect(firstError(errors)).toEqual({ field: 'title', message: '文章标题需为 5～100 个字' })
    expect(firstError({})).toBeUndefined()
  })
})

describe('extract', () => {
  it('htmlToText：块级元素之间补空格，压缩空白，去掉 script/style', () => {
    expect(htmlToText('<h1>标题</h1><p>第一段&nbsp;<b>加粗</b></p><script>x()</script><p>第二段</p>')).toBe(
      '标题 第一段 加粗 第二段',
    )
    expect(htmlToText('')).toBe('')
  })

  it('extractSummary：取正文前 256 字', () => {
    expect(extractSummary({ html: `<p>${'字'.repeat(300)}</p>` })).toBe('字'.repeat(256))
    expect(extractSummary({ html: '<p>短</p>' })).toBe('短')
    expect(extractSummary(undefined)).toBe('')
  })

  it('extractImages：按出现顺序去重，跳过上传中占位与空地址', () => {
    const html =
      '<p><img src="/a.png" alt=""><img alt="" src=\'/b.png?x=1&amp;y=2\'></p><img src="/a.png"><img src="ex-uploading://1"><img src="">'
    expect(extractImages(html)).toEqual(['/a.png', '/b.png?x=1&y=2'])
  })
})

describe('schedule', () => {
  it('datetime-local 与 ISO 互转（本地时间）', () => {
    const date = new Date(2026, 9, 9, 8, 5)
    expect(toLocalInputValue(date)).toBe('2026-10-09T08:05')
    expect(fromLocalInputValue('2026-10-09T08:05')).toBe(date.toISOString())
    expect(fromLocalInputValue('')).toBeUndefined()
    expect(fromLocalInputValue('2026-10-09')).toBeUndefined()
    expect(formatScheduleTime(date.toISOString())).toBe('2026-10-09 08:05')
  })
})

describe('adapterState', () => {
  it('有函数为 enabled，缺失按策略 hidden / disabled', () => {
    const adapters: EditorAdapters = { getCategories: async () => [] }
    expect(adapterState(adapters, 'getCategories', 'hide')).toBe('enabled')
    expect(adapterState(adapters, 'onPublish', 'hide')).toBe('hidden')
    expect(adapterState(adapters, 'onPublish', 'disable')).toBe('disabled')
  })
})
