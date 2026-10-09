import type { EditorAdapters, EditorDocument, Template } from '@editorx/toolbar'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const TEMPLATES: Template[] = [
  { id: 'weekly', name: '周报模板', markdown: '# 本周工作\n\n- \n\n# 下周计划\n\n- \n' },
  { id: 'tech', name: '技术文章模板', markdown: '@[TOC](目录)\n\n# 背景\n\n# 方案\n\n# 总结\n' },
]

/** 预览只接受位图 data URL（markdown-it 拒绝 data:image/svg+xml） */
const RASTER_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

function rasterType(file: File): string | undefined {
  if (Object.values(RASTER_TYPES).includes(file.type)) return file.type
  if (file.type) return undefined
  return RASTER_TYPES[file.name.split('.').pop()?.toLowerCase() ?? '']
}

function readAsDataUrl(file: File, type: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;,]*/, `data:${type}`))
    reader.onerror = () => reject(reader.error ?? new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

/** 演示用 adapters：文件名含 fail 的图片上传失败，只接受 PNG/JPEG/GIF/WebP；保存草稿 200ms 后完成 */
export function createMockAdapters(onSaved: (doc: EditorDocument) => void): EditorAdapters {
  return {
    async uploadImage(file) {
      if (/fail/i.test(file.name)) {
        await delay(300)
        throw new Error('模拟上传失败')
      }
      const type = rasterType(file)
      if (!type) throw new Error('仅支持 PNG、JPEG、GIF、WebP 图片')
      return { url: await readAsDataUrl(file, type) }
    },
    async onSaveDraft(doc) {
      await delay(200)
      onSaved(doc)
    },
    async getTemplates() {
      await delay(100)
      return TEMPLATES
    },
  }
}
