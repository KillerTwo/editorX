import { describe, expect, it } from 'vitest'
import type { EditorExtension, ToolbarItem } from './extension'
import {
  fitGroups,
  flattenChildren,
  isSeparator,
  overflowChildren,
  resolvePanels,
  resolveToolbar,
  type ResolvedChild,
  type ResolvedGroup,
} from './layout'

const noop = () => {}
const button = (id: string, extra: Partial<Extract<ToolbarItem, { type: 'button' }>> = {}): ToolbarItem => ({
  type: 'button',
  id,
  title: id,
  run: noop,
  ...extra,
})
const ids = (groups: readonly ResolvedGroup[]) => groups.map((g) => g.map((r) => r.item.id))
const childIds = (children: readonly ResolvedChild[]) => children.map((c) => (isSeparator(c) ? '|' : c.item.id))
const md = { editorType: 'markdown' as const, adapters: {} }

describe('resolveToolbar', () => {
  const core: EditorExtension = { name: 'core', toolbar: [button('bold'), button('italic'), button('link')] }

  it('按布局分组，未知 id 跳过，重复 id 只取首次，空组丢弃', () => {
    expect(ids(resolveToolbar([core], [['bold', 'nope'], ['italic', 'bold'], ['ghost'], 'link'], md))).toEqual([
      ['bold'],
      ['italic'],
      ['link'],
    ])
  })

  it("'*' 展开剩余条目：按 group 首次出现分组、组内按 order 稳定排序；缺省布局等同 ['*']", () => {
    const ext: EditorExtension = {
      name: 'x',
      toolbar: [
        button('a', { group: 'g1', order: 2 }),
        button('b', { group: 'g2' }),
        button('c', { group: 'g1', order: 1 }),
        button('d', { group: 'g1', order: 1 }),
      ],
    }
    expect(ids(resolveToolbar([core, ext], [['bold'], '*'], md))).toEqual([['bold'], ['italic', 'link'], ['c', 'd', 'a'], ['b']])
    expect(ids(resolveToolbar([ext], undefined, md))).toEqual([['c', 'd', 'a'], ['b']])
  })

  it('同名扩展后者替换前者；同 id 条目后者替换前者且保留位置', () => {
    const replacement: EditorExtension = { name: 'core', toolbar: [button('italic', { title: '新斜体' })] }
    expect(ids(resolveToolbar([core, replacement], undefined, md))).toEqual([['italic']])
    const override: EditorExtension = { name: 'mine', toolbar: [button('bold', { title: '新加粗' })] }
    const groups = resolveToolbar([core, override], undefined, md)
    expect(ids(groups)).toEqual([['bold', 'italic', 'link']])
    expect(groups[0]![0]!.item.title).toBe('新加粗')
    expect(groups[0]![0]!.extension).toBe('mine')
  })

  it('editors 不含当前编辑器的扩展被忽略', () => {
    const rich: EditorExtension = { name: 'rich', editors: ['richtext'], toolbar: [button('video')] }
    expect(ids(resolveToolbar([rich], undefined, md))).toEqual([])
  })

  it('同名替换扩展不适用当前编辑器时，旧扩展也不保留', () => {
    const richOnly: EditorExtension = { name: 'core', editors: ['richtext'], toolbar: [button('video')] }
    expect(ids(resolveToolbar([core, richOnly], undefined, md))).toEqual([])
    expect(resolvePanels([{ name: 'p', panels: [{ id: 'toc', title: 't', position: 'right', render: () => null }] }, { name: 'p', editors: ['richtext'] }], md)).toEqual([])
  })

  it('缺失 adapter：默认隐藏（扩展级与条目级），disable 时标记 disabledByAdapter', () => {
    const exts: EditorExtension[] = [
      { name: 'upload', requires: ['uploadImage'], toolbar: [button('img')] },
      { name: 'mixed', toolbar: [button('tpl', { requires: ['getTemplates'] }), button('plain')] },
    ]
    expect(ids(resolveToolbar(exts, undefined, md))).toEqual([['plain']])
    const disabled = resolveToolbar(exts, undefined, { ...md, missingAdapter: 'disable' })
    expect(disabled.flat().map((r) => [r.item.id, r.disabledByAdapter])).toEqual([
      ['img', true],
      ['tpl', true],
      ['plain', false],
    ])
    const provided = resolveToolbar(exts, undefined, { ...md, adapters: { uploadImage: async () => ({ url: '' }) } })
    expect(ids(provided)).toEqual([['img', 'plain']])
  })

  it('dropdown 子项按 adapter 过滤，修剪多余分隔线；无子项的 dropdown 隐藏', () => {
    const ext: EditorExtension = {
      name: 'menu',
      toolbar: [
        {
          type: 'dropdown',
          id: 'insert',
          title: '插入',
          items: [
            { type: 'separator' },
            button('table'),
            { type: 'separator' },
            button('video', { requires: ['uploadVideo'] }),
            { type: 'separator' },
          ],
        },
        { type: 'dropdown', id: 'empty', title: '空', items: [button('v2', { requires: ['uploadVideo'] })] },
      ],
    }
    const [group] = resolveToolbar([ext], undefined, md)
    expect(group!.map((r) => r.item.id)).toEqual(['insert'])
    expect(childIds(group![0]!.children!)).toEqual(['table'])
  })
})

describe('flattenChildren / overflowChildren', () => {
  it('嵌套 dropdown 展平为分隔线包围的子项', () => {
    const ext: EditorExtension = {
      name: 'm',
      toolbar: [
        {
          type: 'dropdown',
          id: 'outer',
          title: 'outer',
          items: [button('a'), { type: 'dropdown', id: 'inner', title: 'inner', items: [button('b'), button('c')] }],
        },
      ],
    }
    const [group] = resolveToolbar([ext], undefined, md)
    expect(childIds(flattenChildren(group![0]!.children!))).toEqual(['a', '|', 'b', 'c'])
  })

  it('溢出的多个分组之间插入分隔线，dropdown 被展开', () => {
    const ext: EditorExtension = {
      name: 'm',
      toolbar: [
        button('a', { group: '1' }),
        { type: 'dropdown', id: 'd', title: 'd', group: '2', items: [button('x'), button('y')] },
        button('z', { group: '2' }),
      ],
    }
    const groups = resolveToolbar([ext], undefined, md)
    expect(childIds(flattenChildren(overflowChildren(groups)))).toEqual(['a', '|', 'x', 'y', '|', 'z'])
  })
})

describe('fitGroups', () => {
  it('全部放得下时返回总数；否则为「更多」按钮预留空间', () => {
    expect(fitGroups([100, 100, 100], 400, 17, 49)).toBe(3)
    expect(fitGroups([100, 100, 100], 250, 17, 49)).toBe(1)
    expect(fitGroups([100, 100, 100], 300, 17, 49)).toBe(2)
    expect(fitGroups([100], 10, 17, 49)).toBe(0)
  })

  it('恰好放得下时不溢出；空分组返回 0', () => {
    expect(fitGroups([100, 100, 100], 334, 17, 49)).toBe(3)
    expect(fitGroups([100, 100, 100], 333, 17, 49)).toBe(2)
    expect(fitGroups([], 0, 17, 49)).toBe(0)
    expect(fitGroups([], 500, 17, 49)).toBe(0)
  })
})

describe('resolvePanels', () => {
  it('按 order 稳定排序；同 id 后者替换；缺 adapter 的扩展不提供面板', () => {
    const render = () => null
    const panels = resolvePanels(
      [
        { name: 'a', panels: [{ id: 'toc', title: '目录', position: 'right', order: 20, render }] },
        { name: 'b', panels: [{ id: 'ai', title: 'AI', position: 'right', order: 10, render }] },
        { name: 'c', requires: ['aiAssist'], panels: [{ id: 'gpt', title: 'GPT', position: 'right', render }] },
        { name: 'd', panels: [{ id: 'toc', title: '新目录', position: 'right', order: 20, render }] },
      ],
      md,
    )
    expect(panels.map((p) => [p.panel.id, p.extension])).toEqual([
      ['ai', 'b'],
      ['toc', 'd'],
    ])
  })

  it('保留 position 为 left 的面板', () => {
    const render = () => null
    const panels = resolvePanels(
      [{ name: 'toc', panels: [{ id: 'toc', title: '目录', position: 'left', render }] }],
      { editorType: 'richtext', adapters: {} },
    )
    expect(panels.map((item) => item.panel.position)).toEqual(['left'])
  })
})
