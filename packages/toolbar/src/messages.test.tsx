import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { errorMessage, formatMessage, mergeMessages, zhCN } from './messages'
import { MessagesProvider, useMessages } from './messages-context'

function Probe() {
  const m = useMessages()
  return <span data-testid="probe">{`${m.toolbar.bold}|${m.modes.split}|${m.status.saved}`}</span>
}

describe('Messages', () => {
  it('默认中文文案', () => {
    expect(zhCN.toolbar.bold).toBe('加粗')
    expect(zhCN.modes).toMatchObject({ edit: 'Markdown', split: '比对', preview: '预览' })
    expect(zhCN.syntax.items.length).toBeGreaterThan(5)
  })

  it('mergeMessages 深合并，未覆盖的键保留默认，数组整体替换', () => {
    const merged = mergeMessages(zhCN, { toolbar: { bold: 'Bold' }, syntax: { items: [['A', 'a']] } })
    expect(merged.toolbar.bold).toBe('Bold')
    expect(merged.toolbar.italic).toBe('斜体')
    expect(merged.syntax.items).toEqual([['A', 'a']])
    expect(zhCN.toolbar.bold).toBe('加粗')
  })

  it('mergeMessages 跳过 null / undefined 覆盖值（来自 JSON 的语言包）', () => {
    const override = JSON.parse('{"toolbar":{"bold":null,"italic":"Italic"},"dialog":null}')
    const merged = mergeMessages(zhCN, override)
    expect(merged.toolbar.bold).toBe('加粗')
    expect(merged.toolbar.italic).toBe('Italic')
    expect(merged.dialog.close).toBe('关闭')
  })

  it('mergeMessages 未传覆盖时原样返回 base', () => {
    expect(mergeMessages(zhCN)).toBe(zhCN)
    expect(mergeMessages(zhCN, undefined)).toBe(zhCN)
  })

  it('zhCN 深度冻结，合并结果不修改它', () => {
    expect(Object.isFrozen(zhCN)).toBe(true)
    expect(Object.isFrozen(zhCN.toolbar)).toBe(true)
    expect(Object.isFrozen(zhCN.syntax.items)).toBe(true)
    expect(Object.isFrozen(zhCN.syntax.items[0])).toBe(true)
    expect(() => {
      ;(zhCN.toolbar as { bold: string }).bold = 'x'
    }).toThrow(TypeError)
    const merged = mergeMessages(zhCN, { toolbar: { bold: 'Bold' } })
    expect(Object.isFrozen(merged.toolbar)).toBe(false)
    expect(zhCN.toolbar.bold).toBe('加粗')
  })

  it('errorMessage 取 Error.message，其余转字符串', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('plain')).toBe('plain')
    expect(errorMessage(42)).toBe('42')
    expect(errorMessage(undefined)).toBe('undefined')
  })

  it('formatMessage 替换 {name} 占位，未知占位保持原样', () => {
    expect(formatMessage('扩展 {name} 出错：{message}', { name: 'demo', message: 'boom' })).toBe('扩展 demo 出错：boom')
    expect(formatMessage('{a}-{b}', { a: 1 })).toBe('1-{b}')
  })

  it('无 Provider 时 useMessages 返回 zhCN；嵌套 Provider 逐层叠加', () => {
    const { unmount } = render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('加粗|比对|文章已保存')
    unmount()
    render(
      <MessagesProvider messages={{ toolbar: { bold: 'Bold' } }}>
        <MessagesProvider messages={{ modes: { split: 'Split' } }}>
          <Probe />
        </MessagesProvider>
      </MessagesProvider>,
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('Bold|Split|文章已保存')
  })

  it('publish 分桶：CSDN 文案、冻结、可深合并覆盖', () => {
    expect(zhCN.publish.modalTitle).toBe('发布文章')
    expect(zhCN.publish.errors.emptyHtml).toBe('正文不能为空')
    expect(zhCN.publish.a11y.help).toBe('帮助')
    expect(zhCN.publish.fields.tags).toBe('文章标签')
    expect(zhCN.publish.fields.activity).toBe('参与活动')
    expect(zhCN.publish.actions).toMatchObject({
      saveDraft: '保存草稿',
      saveDraftModal: '保存为草稿',
      schedule: '定时发布',
      publish: '发布文章',
      publishInline: '发布博客',
      cancel: '取消',
    })
    expect(zhCN.publish.cover.noImages).toBe('暂无内容图片，请在正文中添加图片')
    expect(formatMessage(zhCN.publish.summary.counterInline, { count: 0, max: 256 })).toBe('0 / 256')
    expect(formatMessage(zhCN.publish.summary.counterModal, { count: 0, max: 256 })).toBe('0/256')
    expect(Object.isFrozen(zhCN.publish.errors)).toBe(true)
    const merged = mergeMessages(zhCN, { publish: { actions: { publish: 'Publish' } } })
    expect(merged.publish.actions.publish).toBe('Publish')
    expect(merged.publish.actions.cancel).toBe('取消')
  })
})

describe('参考图对齐文案', () => {
  it('标签面板文案无多余空格（B22/B23/B24）', () => {
    expect(zhCN.publish.tags.searchPlaceholder).toBe('请输入文字搜索，Enter键入可添加自定义标签')
    expect(zhCN.publish.tags.count).toBe('还可添加{count}个标签')
    expect(zhCN.publish.tags.title).toBe('标签')
    expect(zhCN.publish.tags.section).toBe('添加标签')
    expect(zhCN.publish.tags.recommended).toBe('推荐')
  })

  it('定时发布文案（B27/B28）', () => {
    expect(zhCN.publish.schedule.hint).toBe('请选择当前时间后 {min} 至 {max} 进行定时发布')
    expect(zhCN.publish.schedule.cancel).toBe('取 消')
    expect(zhCN.publish.schedule.confirm).toBe('定时发布')
    expect(zhCN.publish.schedule.units.hours).toBe('{count}小时')
    expect(zhCN.publish.schedule.calendar.weekdays.split(',')).toHaveLength(7)
  })

  it('目录空状态与比对按钮文案（G19/G24）', () => {
    expect(zhCN.panels.tocEmptyTitle).toBe('暂无目录')
    expect(`${zhCN.panels.tocEmptyBefore}${zhCN.panels.tocEmptyAction}${zhCN.panels.tocEmptyAfter}`).toBe(
      '文章内添加@[TOC]自动根据文章标题生成目录',
    )
    expect(zhCN.editor.syncScroll).toBe('同步滚动')
  })
})
