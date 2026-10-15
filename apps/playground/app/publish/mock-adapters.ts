import type { Category, EditorAdapters, PublishOption, TagCategory } from '@geekx/toolbar'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const TAGS = ['React', 'Next.js', 'TypeScript', 'JavaScript', '前端', 'CSS', 'Vite', '性能优化']
const CATEGORIES: Category[] = [
  { id: 'fe', name: '前端开发' },
  { id: 'notes', name: '学习笔记' },
]
const ACTIVITIES: PublishOption[] = [
  { id: 'essay-2026', name: '2026 年度征文' },
  { id: 'summer', name: '开源之夏' },
]
const TOPICS: PublishOption[] = [
  { id: 'ai-coding', name: 'AI 编程' },
  { id: 'fe-eng', name: '前端工程化' },
]
const TAG_CATEGORIES: TagCategory[] = [
  { id: 'recommended', name: '推荐', tags: TAGS.slice(0, 6) },
  { id: 'python', name: 'Python', tags: ['Python', 'Django', 'Flask', 'pandas', 'NumPy'] },
  { id: 'java', name: 'Java' },
  { id: 'lang', name: '编程语言', tags: ['Go', 'Rust', 'C++', 'Kotlin'] },
  { id: 'tools', name: '开发工具', tags: ['VS Code', 'Git', 'Docker', 'Vim'] },
  { id: 'db', name: '数据库', tags: ['MySQL', 'Redis', 'PostgreSQL', 'MongoDB'] },
]
/** 未内联 tags 的分类，演示 getTagsByCategory 按需加载 */
const CATEGORY_TAGS: Record<string, string[]> = { java: ['Java', 'Spring', 'Spring Boot', 'JVM', 'Maven'] }

export type PublishLogKind = 'publish' | 'draft'

export type PublishMockAdapters = Required<
  Pick<
    EditorAdapters,
    | 'onPublish'
    | 'onSaveDraft'
    | 'searchTags'
    | 'getCategories'
    | 'getActivities'
    | 'getTopics'
    | 'uploadImage'
    | 'getTagCategories'
    | 'getTagsByCategory'
  >
>

export interface PublishMockOptions {
  /** false 时 getCategories 返回空数组（与参考截图一致） */
  categories: boolean
  onLog(kind: PublishLogKind, data: object): void
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

/** 演示用发布 adapters：标签含「发布失败」时发布失败；文件名含 fail 的封面上传失败 */
export function createPublishAdapters({ categories, onLog }: PublishMockOptions): PublishMockAdapters {
  return {
    async searchTags(keyword) {
      await delay(150)
      const query = keyword.trim().toLowerCase()
      return (query ? TAGS.filter((tag) => tag.toLowerCase().includes(query)) : TAGS).slice(0, 6)
    },
    async getTagCategories() {
      await delay(100)
      return TAG_CATEGORIES
    },
    async getTagsByCategory(categoryId) {
      await delay(150)
      return CATEGORY_TAGS[categoryId] ?? []
    },
    async getCategories() {
      await delay(100)
      return categories ? CATEGORIES : []
    },
    async getActivities() {
      await delay(100)
      return ACTIVITIES
    },
    async getTopics() {
      await delay(100)
      return TOPICS
    },
    async uploadImage(file) {
      await delay(300)
      if (/fail/i.test(file.name)) throw new Error('模拟上传失败')
      return { url: await readAsDataUrl(file) }
    },
    async onPublish(payload) {
      await delay(300)
      if (payload.tags.includes('发布失败')) throw new Error('模拟发布失败')
      onLog('publish', { ...payload, markdown: undefined, html: undefined })
    },
    async onSaveDraft(doc, settings) {
      await delay(200)
      onLog('draft', { title: doc.title, ...settings })
    },
  }
}
