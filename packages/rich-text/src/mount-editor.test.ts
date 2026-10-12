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
})
