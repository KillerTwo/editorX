type SyntaxItem = [title: string, example: string]

const syntaxItems: SyntaxItem[] = [
  ['标题', '# 一级标题\n## 二级标题'],
  ['加粗 / 斜体', '**加粗** *斜体*'],
  ['删除线 / 高亮', '~~删除~~ ==高亮=='],
  ['上标 / 下标', 'x^2^ H~2~O'],
  ['链接 / 图片', '[链接](https://)\n![图片](https://)'],
  ['列表', '- 无序\n1. 有序\n- [ ] 待办'],
  ['引用', '> 引用内容'],
  ['代码', '`行内代码`\n```js\nconsole.log(1)\n```'],
  ['表格', '| 列1 | 列2 |\n| --- | --- |\n| a | b |'],
  ['公式', '$E=mc^2$\n$$\n\\sum_{i=1}^n i\n$$'],
  ['目录', '@[TOC](目录标题)'],
  ['脚注', '正文[^1]\n[^1]: 脚注内容'],
  ['流程图', '```mermaid\nflowchart LR\n  A --> B\n```'],
]

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

/** 深度冻结：多个编辑器共享这一默认对象，修改它会影响所有实例；需要改动时用 mergeMessages 生成新对象 */
export const zhCN = deepFreeze({
  toolbar: {
    label: '编辑工具栏',
    more: '更多',
    bold: '加粗',
    italic: '斜体',
    heading: '标题',
    heading1: '一级标题',
    heading2: '二级标题',
    heading3: '三级标题',
    heading4: '四级标题',
    heading5: '五级标题',
    heading6: '六级标题',
    strikethrough: '删除线',
    list: '列表',
    unorderedList: '无序列表',
    orderedList: '有序列表',
    taskList: '待办列表',
    code: '代码块',
    codeBlock: '代码块',
    inlineCode: '行内代码',
    moreFormat: '更多格式',
    quote: '引用',
    hr: '分割线',
    mark: '高亮',
    superscript: '上标',
    subscript: '下标',
    image: '图片',
    link: '链接',
    moreInsert: '更多插入',
    table: '表格',
    mathBlock: '公式',
    mathInline: '行内公式',
    toc: '目录',
    mermaidFlowchart: '流程图',
    mermaidSequence: '时序图',
    mermaidGantt: '甘特图',
    mermaidClass: '类图',
    moreActions: '更多操作',
    importFile: '导入文件',
    exportMarkdown: '导出为 Markdown',
    exportHtml: '导出为 HTML',
    syntax: '语法说明',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    untitled: '未命名',
  },
  dialog: {
    confirm: '确定',
    cancel: '取消',
    close: '关闭',
    linkText: '链接文本',
    linkUrl: '链接地址',
    imageUrl: '图片地址',
    imageAlt: '图片描述',
    imageUpload: '本地上传',
    tableRows: '行数',
    tableCols: '列数',
  },
  modes: {
    label: '视图模式',
    edit: 'Markdown',
    split: '比对',
    preview: '预览',
  },
  theme: {
    toLight: '切换到明亮模式',
    toDark: '切换到暗黑模式',
  },
  status: {
    label: '状态栏',
    markdown: 'Markdown',
    html: 'HTML',
    words: '字数',
    lines: '行数',
    paragraphs: '段落',
    line: '当前行',
    column: '当前列',
    saving: '保存中…',
    saved: '文章已保存',
    saveFailed: '保存失败',
  },
  panels: {
    rail: '侧边栏',
    collapse: '收起',
    expand: '展开',
    toc: '目录',
    tocEmpty: '为文内增加标题，这里将生成目录',
    syntax: '语法',
  },
  upload: {
    uploading: '上传中...',
    failed: '上传失败',
    failedList: '上传失败的图片',
    failedItem: '{name} 上传失败',
    retry: '重试',
    remove: '删除',
    /** 失败列表中重试/删除按钮的无障碍名称 */
    retryItem: '重试 {name}',
    removeItem: '删除 {name}',
    notImage: '仅支持上传图片文件',
    noAdapter: '未配置图片上传',
    error: '图片 {name} 上传失败：{message}',
  },
  editor: {
    ariaLabel: 'Markdown 编辑区',
    previewLabel: '预览区',
    splitter: '调整编辑区与预览区宽度',
  },
  errors: {
    extension: '扩展 {name} 出错：{message}',
    import: '导入失败：{message}',
    export: '导出失败：{message}',
    save: '保存失败：{message}',
  },
  syntax: {
    items: syntaxItems,
  },
})

export type Messages = typeof zhCN

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeDeep(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined || value === null) continue
    const current = out[key]
    out[key] = isPlainObject(current) && isPlainObject(value) ? mergeDeep(current, value) : value
  }
  return out
}

export function mergeMessages(base: Messages, override?: DeepPartial<Messages>): Messages {
  if (!override) return base
  return mergeDeep(base as unknown as Record<string, unknown>, override as Record<string, unknown>) as unknown as Messages
}

export function formatMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match))
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
