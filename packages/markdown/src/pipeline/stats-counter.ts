import { countHtml, countWords, type HtmlCount, type RenderedSection, type WordCount } from '@editorx/markdown-core'

export interface PreviewStats {
  /** Markdown 源码非空白字符数（G18：「test」→ 4） */
  mdChars: number
  /** 编辑器行数：换行数 + 1；文本不以 '\n' 结尾时再 + 1（cledit getTextContent 语义；空文档为 2） */
  lines: number
  /** 渲染文本非空白字符数 */
  htmlChars: number
  paragraphs: number
}

/**
 * 按段累加统计，以段源码/HTML 为键缓存。与整篇统计相等：段落在行首切分（单词不跨段），
 * 且每段渲染在独立的块包装内。
 */
export function createStatsCounter() {
  const md = new Map<string, WordCount>()
  const html = new Map<string, HtmlCount>()
  const prune = <T>(cache: Map<string, T>, used: Set<string>) => {
    for (const key of cache.keys()) if (!used.has(key)) cache.delete(key)
  }
  return {
    /** hasTime() 用尽时返回 null；已算完的段保留在缓存中 */
    count(sections: readonly RenderedSection[], hasTime: () => boolean): PreviewStats | null {
      const usedMd = new Set<string>()
      const usedHtml = new Set<string>()
      const stats: PreviewStats = { mdChars: 0, lines: 1, htmlChars: 0, paragraphs: 0 }
      for (const section of sections) {
        let words = md.get(section.text)
        let markup = html.get(section.html)
        if ((!words || !markup) && !hasTime()) return null
        if (!words) md.set(section.text, (words = countWords(section.text)))
        if (!markup) html.set(section.html, (markup = countHtml(section.html)))
        usedMd.add(section.text)
        usedHtml.add(section.html)
        stats.mdChars += words.chars
        stats.lines += words.lines - 1
        stats.htmlChars += markup.chars
        stats.paragraphs += markup.paragraphs
      }
      // cledit 在内容末尾不是换行时补一个换行，编辑器因此多出一行（空文档也是 2 行）
      if (!(sections.at(-1)?.text ?? '').endsWith('\n')) stats.lines += 1
      prune(md, usedMd)
      prune(html, usedHtml)
      return stats
    },
  }
}
