export type EditorType = 'markdown' | 'richtext'

export interface EditorDocument {
  editorType: EditorType
  title: string
  markdown?: string
  html: string
}

export interface Category {
  id: string
  name: string
}

export interface VoteInput {
  title: string
  options: string[]
  multiple: boolean
  /** ISO 时间 */
  deadline?: string
}

export interface Resource {
  id: string
  title: string
  url: string
  description?: string
}

export interface Template {
  id: string
  name: string
  markdown?: string
  html?: string
}

/** 字段对应 CSDN「发布文章」表单（spec §6.3）；校验规则在阶段 4 定义 */
export interface PublishSettings {
  tags: string[]
  cover: { mode: 'single' | 'triple' | 'none'; urls: string[] }
  summary: string
  categories: string[]
  articleType: 'original' | 'reprint' | 'translated'
  sourceUrl?: string
  visibility: 'public' | 'private' | 'fans' | 'vip'
  scheduledAt?: string
}

export type PublishPayload = EditorDocument & PublishSettings

export interface EditorAdapters {
  uploadImage?(file: File, onProgress?: (p: number) => void): Promise<{ url: string }>
  onSaveDraft?(doc: EditorDocument): Promise<void>
  onPublish?(payload: PublishPayload): Promise<void>
  searchTags?(keyword: string): Promise<string[]>
  getCategories?(): Promise<Category[]>
  aiAssist?(prompt: string, ctx: { selection: string; document: EditorDocument }): AsyncIterable<string>
  createVote?(data: VoteInput): Promise<{ id: string }>
  uploadVideo?(file: File, onProgress?: (p: number) => void): Promise<{ url: string; cover?: string }>
  searchResources?(keyword: string): Promise<Resource[]>
  runCode?(lang: string, code: string): Promise<{ url: string }>
  getTemplates?(): Promise<Template[]>
}

export type AdapterName = keyof EditorAdapters
