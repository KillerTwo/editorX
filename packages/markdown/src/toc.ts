/** 与 markdown-core 渲染器 `TOC_MARKER` 一致（不区分大小写、两侧空白忽略），只取带标题的写法 */
const TOC_TITLE = /^ {0,3}@\[toc\]\(([^)\n]*)\)[ \t]*$/i
/** 渲染器识别的全部写法：`@[TOC](标题)`、`@[TOC]`、`[TOC]`；第 1 组为缩进，第 2 组为标记，第 3 组为标题 */
const TOC_ANY = /^( {0,3})(@\[toc\](?:\(([^)\n]*)\))?|\[toc\])[ \t]*$/i
/** 快速路径：没有标记时不逐行扫描（每次防抖渲染都会调用） */
const HAS_TOC_TITLE = /@\[toc\]\(/i
const HAS_TOC = /\[toc\]/i
const FENCE_OPEN = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/
const BLANK = /^[ \t]*$/
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
/** 能打断段落的行：引用、无序列表、以 1 开头的有序列表 */
const INTERRUPTS = /^ {0,3}(?:>|[-*+][ \t]+\S|1[.)][ \t]+\S)/

/**
 * 依次产出渲染器会识别为目录的标记行（pattern 匹配的行）及其行首偏移：标记独占一个顶层段落、
 * 不在围栏代码块内。近似：HTML 块与列表项内部的缩进段落不做识别。
 */
function* tocMarkerLines(markdown: string, pattern: RegExp): Generator<{ match: RegExpExecArray; offset: number }> {
  const lines = markdown.split('\n')
  /** 当前围栏的闭合行正则 */
  let fenceClose: RegExp | null = null
  /** 上一行结束了段落（文档开头、空行、ATX 标题、围栏闭合、分隔线/setext 下划线） */
  let paragraphClosed = true
  for (let i = 0, offset = 0; i < lines.length; offset += lines[i]!.length + 1, i++) {
    const line = lines[i]!
    if (fenceClose) {
      if (fenceClose.test(line)) {
        fenceClose = null
        paragraphClosed = true
      }
      continue
    }
    const open = FENCE_OPEN.exec(line)
    if (open) {
      const marker = open[1]!
      fenceClose = new RegExp(`^ {0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}[ \\t]*$`)
      continue
    }
    const match = paragraphClosed ? pattern.exec(line) : null
    if (match) {
      const next = lines[i + 1]
      const endsParagraph =
        next === undefined ||
        BLANK.test(next) ||
        ATX_HEADING.test(next) ||
        FENCE_OPEN.test(next) ||
        (!SETEXT_UNDERLINE.test(next) && (THEMATIC_BREAK.test(next) || INTERRUPTS.test(next)))
      if (endsParagraph) yield { match, offset }
    }
    paragraphClosed =
      BLANK.test(line) || ATX_HEADING.test(line) || SETEXT_UNDERLINE.test(line) || THEMATIC_BREAK.test(line)
  }
}

/** `@[TOC](标题)` 中的标题（首个非空标题） */
export function extractTocTitle(markdown: string): string | null {
  if (!HAS_TOC_TITLE.test(markdown)) return null
  for (const { match } of tocMarkerLines(markdown, TOC_TITLE)) {
    const title = match[1]!.trim()
    if (title) return title
  }
  return null
}

/** 首个目录标记的选区：有标题时为标题文本（去两侧空白），否则为整个标记；没有标记返回 null */
export function tocMarkerSelection(markdown: string): { start: number; end: number } | null {
  if (!HAS_TOC.test(markdown)) return null
  for (const { match, offset } of tocMarkerLines(markdown, TOC_ANY)) {
    const markerStart = offset + match[1]!.length
    const raw = match[3]
    const title = raw?.trim()
    if (raw === undefined || !title) return { start: markerStart, end: markerStart + match[2]!.length }
    const start = markerStart + '@[toc]('.length + raw.indexOf(title)
    return { start, end: start + title.length }
  }
  return null
}
