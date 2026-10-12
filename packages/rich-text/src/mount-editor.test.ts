import { describe, expect, it } from 'vitest'
import { createEditorConfig } from './ck-config'
import { mountEditor } from './mount-editor'

describe('mountEditor readOnly', () => {
  it('锁定后编辑区不可输入，解除后恢复', async () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = await mountEditor(element, createEditorConfig({}), '<p>a</p>')
    editor.setReadOnly(true)
    expect(element.getAttribute('contenteditable')).toBe('false')
    editor.setReadOnly(false)
    expect(element.getAttribute('contenteditable')).toBe('true')
    await editor.destroy()
  })

  it('getSelectionText 返回选中文本；insert 保留选区，replace 先删再插', async () => {
    const element = document.createElement('div')
    document.body.append(element)
    const editor = await mountEditor(element, createEditorConfig({}), '<p>hello world</p>')
    const instance = (element as HTMLElement & { ckeditorInstance?: CkInstance }).ckeditorInstance
    expect(instance).toBeTruthy()
    const select = (start: number, end: number) => {
      instance!.model.change((writer) => {
        const paragraph = instance!.model.document.getRoot()!.getChild(0)
        writer.setSelection(
          writer.createRange(writer.createPositionAt(paragraph, start), writer.createPositionAt(paragraph, end)),
        )
      })
    }
    select(0, 5)
    expect(editor.getSelectionText()).toBe('hello')
    editor.insertHtml('<strong>Z</strong>')
    expect(editor.getData()).toContain('hello')
    expect(editor.getData()).toContain('world')
    select(0, 5)
    editor.replaceHtml('<strong>Y</strong>')
    expect(editor.getSelectionText()).not.toBe('hello')
    expect(editor.getData()).not.toContain('hello')
    expect(editor.getData()).toContain('Y')
    expect(editor.getData()).toContain('world')
    await editor.destroy()
  })
})

type CkWriter = {
  createPositionAt(item: unknown, offset: number): unknown
  createRange(start: unknown, end: unknown): unknown
  setSelection(range: unknown): void
}

type CkInstance = {
  model: {
    document: { getRoot(): { getChild(index: number): unknown } | null }
    change(callback: (writer: CkWriter) => void): void
  }
}
