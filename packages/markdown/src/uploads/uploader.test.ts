import { ClEditEngine, createRenderer } from '@editorx/markdown-core'
import { mergeMessages, zhCN, type Messages } from '@editorx/toolbar'
import { describe, expect, it, vi } from 'vitest'
import { createEditorStore } from '../store'
import { findPlaceholder, imageMarkdown } from './placeholders'
import { createUploader, imageFiles } from './uploader'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(value: string, uploadImage?: (file: File) => Promise<{ url: string }>, messages: Messages = zhCN) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const engine = new ClEditEngine()
  engine.mount(host, { value })
  const store = createEditorStore()
  const notify = vi.fn()
  let n = 0
  const uploader = createUploader({
    engine,
    store,
    getAdapters: () => (uploadImage ? { uploadImage } : {}),
    getMessages: () => messages,
    notify,
    createId: () => `u${++n}`,
  })
  return { engine, store, notify, uploader }
}

const png = (name = 'shot.png') => new File(['x'], name, { type: 'image/png' })

describe('placeholders', () => {
  it('按 id 找到上传中或失败占位', () => {
    const uploading = '![上传中...](ex-uploading://u1)'
    const failed = '![上传失败](ex-upload-failed://u2)'
    const md = `a${uploading}b${failed}`
    expect(findPlaceholder(md, 'u1')).toEqual({ start: 1, end: 1 + uploading.length })
    const range = findPlaceholder(md, 'u2')!
    expect(md.slice(range.start, range.end)).toBe(failed)
    expect(findPlaceholder(md, 'u3')).toBeNull()
  })

  it('id 前缀不误匹配', () => {
    expect(findPlaceholder('![x](ex-uploading://u10)', 'u1')).toBeNull()
  })

  it('imageFiles 只保留图片', () => {
    expect(imageFiles([png(), new File(['x'], 'a.pdf', { type: 'application/pdf' })]).map((f) => f.name)).toEqual(['shot.png'])
  })

  it('imageMarkdown 转义文件名与地址，无法跳出 ![alt](url)', () => {
    const md = imageMarkdown('a]b[c\\d(e)\r\nf.png', 'https://x/a b)c(d<e>\nf\\g')
    expect(md).toBe('![a\\]b\\[c\\\\d(e) f](https://x/a%20b\\)c\\(d\\<e\\>%0Af\\\\g)')
    const html = createRenderer().render(`${md}\n\n后文`).html
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const imgs = doc.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0]!.getAttribute('alt')).toBe('a]b[c\\d(e) f')
    expect(imgs[0]!.getAttribute('src')).toBe('https://x/a%20b)c(d%3Ce%3E%0Af%5Cg')
    expect(doc.body.textContent).toContain('后文')
  })
})

describe('createUploader', () => {
  it('在光标处插入占位，成功后替换为图片并保持用户选区', async () => {
    const d = deferred<{ url: string }>()
    const { engine, uploader } = setup('ab', () => d.promise)
    engine.setSelection(1, 1)
    const done = uploader.upload([png()])
    expect(engine.getValue()).toBe('a![上传中...](ex-uploading://u1)b')
    engine.replace(0, 0, 'X')
    engine.setSelection(0, 1)
    d.resolve({ url: 'https://cdn/x.png' })
    await done
    expect(engine.getValue()).toBe('Xa![shot](https://cdn/x.png)b')
    expect(engine.getSelection()).toEqual({ start: 0, end: 1 })
  })

  it('选区在占位之后时按长度差平移', async () => {
    const d = deferred<{ url: string }>()
    const { engine, uploader } = setup('ab', () => d.promise)
    engine.setSelection(1, 1)
    const done = uploader.upload([png()])
    const end = engine.getValue().length
    engine.setSelection(end, end)
    d.resolve({ url: 'u' })
    await done
    expect(engine.getValue()).toBe('a![shot](u)b')
    expect(engine.getSelection()).toEqual({ start: 12, end: 12 })
  })

  it('并发上传各自替换自己的占位（乱序完成、用户在中间编辑）', async () => {
    const first = deferred<{ url: string }>()
    const second = deferred<{ url: string }>()
    const queue = [first, second]
    const { engine, uploader } = setup('', () => queue.shift()!.promise)
    const done = uploader.upload([png('a.png'), png('b.png')])
    const newline = engine.getValue().indexOf('\n')
    engine.replace(newline, newline + 1, '\n中间\n')
    second.resolve({ url: 'https://cdn/b.png' })
    await new Promise((r) => setTimeout(r, 0))
    expect(engine.getValue()).toBe('![上传中...](ex-uploading://u1)\n中间\n![b](https://cdn/b.png)')
    engine.replace(0, 0, '开头\n')
    first.resolve({ url: 'https://cdn/a.png' })
    await done
    expect(engine.getValue()).toBe('开头\n![a](https://cdn/a.png)\n中间\n![b](https://cdn/b.png)')
  })

  it('替换经由引擎编辑：可撤销回占位与原文', async () => {
    const { engine, uploader } = setup('ab', async () => ({ url: 'u' }))
    engine.setSelection(1, 1)
    await uploader.upload([png()])
    expect(engine.getValue()).toBe('a![shot](u)b')
    engine.undo()
    expect(engine.getValue()).toBe('a![上传中...](ex-uploading://u1)b')
    engine.undo()
    expect(engine.getValue()).toBe('ab')
  })

  it('失败：替换为失败占位、记录失败项并提示；重试成功后清除', async () => {
    const upload = vi.fn().mockRejectedValueOnce(new Error('网络错误')).mockResolvedValueOnce({ url: 'https://cdn/ok.png' })
    const { engine, store, notify, uploader } = setup('', upload)
    await uploader.upload([png()])
    expect(engine.getValue()).toBe('![上传失败](ex-upload-failed://u1)')
    expect(store.get().uploads).toEqual([{ id: 'u1', name: 'shot.png' }])
    expect(notify).toHaveBeenCalledWith('图片 shot.png 上传失败：网络错误', 'error')
    await uploader.retry('u1')
    expect(engine.getValue()).toBe('![shot](https://cdn/ok.png)')
    expect(store.get().uploads).toEqual([])
  })

  it('重试进行中再次重试被忽略', async () => {
    const d = deferred<{ url: string }>()
    const upload = vi.fn().mockRejectedValueOnce(new Error('x')).mockReturnValueOnce(d.promise)
    const { engine, uploader } = setup('', upload)
    await uploader.upload([png()])
    const retrying = uploader.retry('u1')
    await uploader.retry('u1')
    expect(upload).toHaveBeenCalledTimes(2)
    d.resolve({ url: 'ok' })
    await retrying
    expect(engine.getValue()).toBe('![shot](ok)')
  })

  it('删除失败项：移除占位与记录', async () => {
    const { engine, store, uploader } = setup('a', () => Promise.reject(new Error('x')))
    engine.setSelection(1, 1)
    await uploader.upload([png()])
    uploader.remove('u1')
    expect(engine.getValue()).toBe('a')
    expect(store.get().uploads).toEqual([])
  })

  it('多文件逐行插入；非图片给出警告；未配置 adapter 不插入', async () => {
    const { engine, uploader, notify } = setup('', () => new Promise(() => {}))
    void uploader.upload([png('a.png'), new File(['x'], 'b.txt', { type: 'text/plain' }), png('c.png')])
    expect(engine.getValue()).toBe('![上传中...](ex-uploading://u1)\n![上传中...](ex-uploading://u2)')
    expect(notify).toHaveBeenCalledWith('仅支持上传图片文件', 'warning')
    const bare = setup('z')
    await bare.uploader.upload([png()])
    expect(bare.engine.getValue()).toBe('z')
    expect(bare.notify).toHaveBeenCalledWith('未配置图片上传', 'warning')
  })

  it('占位已被用户删除时静默丢弃结果', async () => {
    const d = deferred<{ url: string }>()
    const { engine, uploader } = setup('', () => d.promise)
    const done = uploader.upload([png()])
    engine.replace(0, engine.getValue().length, '清空')
    d.resolve({ url: 'https://cdn/x.png' })
    await done
    expect(engine.getValue()).toBe('清空')
  })

  it('文案含 ] 时占位仍可定位', async () => {
    const messages = mergeMessages(zhCN, { upload: { uploading: '[up]', failed: 'fail]' } })
    const { engine, uploader } = setup('', () => Promise.reject(new Error('x')), messages)
    await uploader.upload([png()])
    expect(engine.getValue()).toBe('![fail\\]](ex-upload-failed://u1)')
    uploader.remove('u1')
    expect(engine.getValue()).toBe('')
  })

  it('detach 后到达的结果不写入引擎、不提示、不改 store', async () => {
    const ok = deferred<{ url: string }>()
    const bad = deferred<{ url: string }>()
    const queue = [ok, bad]
    const { engine, store, notify, uploader } = setup('', () => queue.shift()!.promise)
    const detach = uploader.attach()
    const done = uploader.upload([png('a.png'), png('b.png')])
    const before = engine.getValue()
    detach()
    engine.destroy()
    ok.resolve({ url: 'u' })
    bad.reject(new Error('x'))
    await done
    expect(engine.getValue()).toBe(before)
    expect(notify).not.toHaveBeenCalled()
    expect(store.get().uploads).toEqual([])
    await uploader.upload([png()])
    expect(engine.getValue()).toBe(before)
  })
})
