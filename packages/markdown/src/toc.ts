const TOC_TITLE = /^@\[TOC\]\(([^)\n]*)\)[ \t]*$/m

/** `@[TOC](标题)` 中的标题；只认独占一行的写法 */
export function extractTocTitle(markdown: string): string | null {
  const title = TOC_TITLE.exec(markdown)?.[1]?.trim()
  return title ? title : null
}
