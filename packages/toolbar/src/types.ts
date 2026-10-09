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

export type CoverMode = 'single' | 'triple' | 'none'
export type ArticleType = 'original' | 'reprint' | 'translated'
export type Visibility = 'public' | 'private' | 'fans' | 'vip'
/** 创作声明：无声明 / AI 辅助 / 网络整合 / 个人观点 */
export type CreationDeclaration = 'none' | 'ai' | 'network' | 'personal'

export interface PublishCover {
  mode: CoverMode
  /** single 最多 1 张，triple 最多 3 张，none 为空 */
  urls: string[]
}

/** 下拉选项：创作活动、话题、文章模板 */
export interface PublishOption {
  id: string
  name: string
  disabled?: boolean
}

/** CSDN「发布文章」表单：spec §6.3 字段 + 参考截图 12-36-05 / 12-36-37 的额外字段 */
export interface PublishSettings {
  /** 文章标签，1–7 个 */
  tags: string[]
  cover: PublishCover
  /** ≤256 字 */
  summary: string
  /** 分类专栏 Category.id */
  categories: string[]
  articleType: ArticleType
  /** articleType 为 reprint / translated 时必填 */
  sourceUrl?: string
  declaration: CreationDeclaration
  /** 文章备份：同时备份到 GitCode */
  backupToGitCode: boolean
  visibility: Visibility
  /** 文章模板 PublishOption.id，默认 'default' */
  template: string
  multiPlatform: boolean
  /** 参与活动 PublishOption.id */
  activityId?: string
  /** 话题 PublishOption.id */
  topicId?: string
  /** ISO 8601；有值即定时发布 */
  scheduledAt?: string
}

export type PublishPayload = EditorDocument & PublishSettings

export interface EditorAdapters {
  uploadImage?(file: File, onProgress?: (p: number) => void): Promise<{ url: string }>
  /**
   * 保存草稿；从发布面板触发时附带当前发布设置。
   * 自动保存（仅 Markdown 有改动时）与 `saveDraft()` 调用。不会并发调用：进行中时的请求合并为一次后续调用；
   * 若已排队，可能在编辑器卸载后才调用。reject 表示保存失败。
   */
  onSaveDraft?(doc: EditorDocument, settings?: PublishSettings): Promise<void>
  onPublish?(payload: PublishPayload): Promise<void>
  searchTags?(keyword: string): Promise<string[]>
  getCategories?(): Promise<Category[]>
  /** 发布面板「参与活动」下拉选项 */
  getActivities?(): Promise<PublishOption[]>
  /** 发布面板「话题」下拉选项 */
  getTopics?(): Promise<PublishOption[]>
  aiAssist?(prompt: string, ctx: { selection: string; document: EditorDocument }): AsyncIterable<string>
  createVote?(data: VoteInput): Promise<{ id: string }>
  uploadVideo?(file: File, onProgress?: (p: number) => void): Promise<{ url: string; cover?: string }>
  searchResources?(keyword: string): Promise<Resource[]>
  runCode?(lang: string, code: string): Promise<{ url: string }>
  getTemplates?(): Promise<Template[]>
}

export type AdapterName = keyof EditorAdapters
