/** 与 markdown-core 渲染器 `TOC_MARKER` 一致（不区分大小写、两侧空白忽略），只取带标题的写法 */
const TOC_TITLE = /^ {0,3}@\[toc\]\(([^)\n]*)\)[ \t]*$/i
const FENCE_OPEN = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/
const BLANK = /^[ \t]*$/
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
/** 能打断段落的行：引用、无序列表、以 1 开头的有序列表 */
const INTERRUPTS = /^ {0,3}(?:>|[-*+][ \t]+\S|1[.)][ \t]+\S)/

/**
 * `@[TOC](标题)` 中的标题（首个非空标题），只认渲染器会识别为目录的写法：标记独占一个顶层段落、
 * 不在围栏代码块内。近似：HTML 块与列表项内部的缩进段落不做识别。
 */
export function extractTocTitle(markdown: string): string | null {
  const lines = markdown.split('\n')
  let fence: { char: string; length: number } | null = null
  /** 上一行结束了段落（文档开头、空行、ATX 标题、围栏闭合、分隔线/setext 下划线） */
  let paragraphClosed = true
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (fence) {
      const close = new RegExp(`^ {0,3}${fence.char === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`)
      if (close.test(line)) {
        fence = null
        paragraphClosed = true
      }
      continue
    }
    const open = FENCE_OPEN.exec(line)
    if (open) {
      fence = { char: open[1]![0]!, length: open[1]!.length }
      continue
    }
    const marker = paragraphClosed ? TOC_TITLE.exec(line) : null
    if (marker) {
      const next = lines[i + 1]
      const endsParagraph =
        next === undefined ||
        BLANK.test(next) ||
        ATX_HEADING.test(next) ||
        FENCE_OPEN.test(next) ||
        (!SETEXT_UNDERLINE.test(next) && (THEMATIC_BREAK.test(next) || INTERRUPTS.test(next)))
      const title = marker[1]!.trim()
      if (endsParagraph && title) return title
    }
    paragraphClosed =
      BLANK.test(line) || ATX_HEADING.test(line) || SETEXT_UNDERLINE.test(line) || THEMATIC_BREAK.test(line)
  }
  return null
}
