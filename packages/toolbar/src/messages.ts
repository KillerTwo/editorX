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
    saved: '文章已保存{time}',
    saveFailed: '保存失败',
  },
  panels: {
    rail: '侧边栏',
    collapse: '收起',
    expand: '展开',
    toc: '目录',
    tocEmpty: '为文内增加标题，这里将生成目录',
    tocEmptyTitle: '暂无目录',
    tocEmptyBefore: '文章内',
    tocEmptyAction: '添加',
    tocEmptyAfter: '@[TOC]自动根据文章标题生成目录',
    syntax: '语法',
    resize: '调整面板宽度',
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
    syncLocate: '定位到编辑位置',
    syncScroll: '同步滚动',
  },
  errors: {
    extension: '扩展 {name} 出错：{message}',
    import: '导入失败：{message}',
    export: '导出失败：{message}',
    save: '保存失败：{message}',
  },
  publish: {
    label: '发布设置',
    modalTitle: '发布文章',
    fields: {
      tags: '文章标签',
      cover: '添加封面',
      summary: '文章摘要',
      categories: '分类专栏',
      articleType: '文章类型',
      sourceUrl: '原文链接',
      declaration: '创作声明',
      backup: '文章备份',
      visibility: '可见范围',
      template: '文章模板',
      multiPlatform: '多平台发布',
      activity: '参与活动',
      activitySuffix: '/话题',
      activitySub: '活动',
      topicSub: '话题',
    },
    help: {
      tags: '标签可以帮助文章被更多读者发现，最多添加 7 个',
      cover: '封面会在推荐、列表等场景展示，建议比例 16:9',
      summary: '摘要会在推荐、列表等场景外露，不填则默认提取正文前 256 个字',
      categories: '将文章归入已有的分类专栏',
      articleType: '转载与翻译文章需要填写原文链接',
      visibility: '设置哪些读者可以看到这篇文章',
      template: '选择文章详情页的展示模板',
      activity: '参与创作活动或话题，获得更多曝光',
    },
    tags: {
      add: '添加文章标签',
      search: '搜索标签',
      searchPlaceholder: '请输入文字搜索，Enter键入可添加自定义标签',
      suggestions: '推荐标签',
      empty: '暂无相关标签',
      count: '还可添加{count}个标签',
      remove: '删除标签',
      title: '标签',
      section: '添加标签',
      categories: '标签分类',
      recommended: '推荐',
      close: '关闭标签面板',
    },
    cover: {
      modes: '封面类型',
      single: '单图',
      triple: '三图',
      none: '无封面',
      upload: '从本地上传',
      uploading: '上传中…',
      replace: '更换',
      remove: '删除封面',
      slot: '封面 {index}',
      bodyImages: '正文图片',
      pick: '选择正文图片 {index} 作为封面',
      noImages: '暂无内容图片，请在正文中添加图片',
      cropTitle: '裁剪封面',
      cropZoom: '缩放',
      cropArea: '裁剪区域，可拖动或用方向键移动',
    },
    summary: {
      placeholderInline:
        '摘要：会在推荐、列表等场景外露，帮助读者快速了解内容，支持一键将正文前 256 字符键入摘要文本框',
      placeholderModal: '本内容会在各展现列表中展示，帮助读者快速了解内容。若不填，则默认提取正文前256个字。',
      counterInline: '{count} / {max}',
      counterModal: '{count}/{max}',
      extract: 'AI提取摘要',
    },
    categories: {
      loading: '加载中…',
      emptyInline: '专栏已达到上限，暂不可创建新专栏，请选择已有专栏',
      emptyModal: '您暂时不能添加分类专栏!',
    },
    articleType: {
      original: '原创',
      reprint: '转载',
      translated: '翻译',
      sourceUrlPlaceholder: '请填写原文链接',
    },
    declaration: {
      none: '无声明',
      ai: '部分内容由AI辅助生成',
      network: '内容来源网络，进行整合/再创作',
      personal: '个人观点，仅供参考',
    },
    backup: {
      label: '同时备份到GitCode',
      agreementPrefix: '您已同意GitCode ',
      terms: '用户协议',
      and: ' 和 ',
      privacy: '隐私政策',
      agreementSuffix: '，我们会为您自动创建账号并备份文章至我的项目。',
    },
    visibility: { public: '全部可见', private: '仅我可见', fans: '粉丝可见', vip: 'VIP可见' },
    template: { default: '默认模板', simple: '简洁模板', moyan: '墨衍模板' },
    multiPlatform: { no: '否', yes: '是' },
    activity: { placeholder: '请选择创作活动', topicPlaceholder: '请选择创作话题' },
    actions: {
      label: '发布操作',
      saveDraft: '保存草稿',
      saveDraftModal: '保存为草稿',
      schedule: '定时发布',
      publish: '发布文章',
      publishInline: '发布博客',
      cancel: '取消',
    },
    schedule: {
      title: '定时发布',
      hint: '请选择当前时间后 {min} 至 {max} 进行定时发布',
      label: '发布时间',
      dateLabel: '发布日期',
      datePlaceholder: '选择日期',
      timePlaceholder: '选择时间',
      cancel: '取 消',
      confirm: '定时发布',
      units: { minutes: '{count}分钟', hours: '{count}小时', days: '{count}天' },
      calendar: {
        prevYear: '前一年',
        prevMonth: '上个月',
        nextMonth: '下个月',
        nextYear: '后一年',
        monthTitle: '{year} 年 {month} 月',
        weekdays: '日,一,二,三,四,五,六',
      },
    },
    status: {
      published: '发布成功',
      scheduled: '已设置定时发布：{time}',
      draftSaved: '草稿已保存',
    },
    errors: {
      title: '文章标题需为 {min}～{max} 个字',
      tagsRequired: '请至少添加 1 个文章标签',
      tagsMax: '最多添加 {max} 个文章标签',
      summaryMax: '摘要不能超过 {max} 个字',
      coverTriple: '三图封面需要选择 3 张图片',
      sourceUrlRequired: '转载或翻译文章请填写原文链接',
      sourceUrlInvalid: '原文链接需以 http:// 或 https:// 开头',
      scheduledAtInvalid: '请选择有效的发布时间',
      scheduledAtPast: '发布时间需晚于当前时间',
      scheduledAtTooSoon: '请选择当前时间后 {min} 至 {max} 进行定时发布',
      scheduledAtTooLate: '请选择当前时间后 {min} 至 {max} 进行定时发布',
      publish: '发布失败：{message}',
      saveDraft: '保存草稿失败：{message}',
      load: '{name}加载失败：{message}',
      upload: '封面上传失败：{message}',
    },
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
