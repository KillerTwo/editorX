import { countHtml, countWords, type HtmlCount, type RenderedSection, type WordCount } from '@editorx/markdown-core'

export interface PreviewStats {
  mdWords: number
  lines: number
  htmlWords: number
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
      const stats: PreviewStats = { mdWords: 0, lines: 1, htmlWords: 0, paragraphs: 0 }
      for (const section of sections) {
        let words = md.get(section.text)
        let markup = html.get(section.html)
        if ((!words || !markup) && !hasTime()) return null
        if (!words) md.set(section.text, (words = countWords(section.text)))
        if (!markup) html.set(section.html, (markup = countHtml(section.html)))
        usedMd.add(section.text)
        usedHtml.add(section.html)
        stats.mdWords += words.words
        stats.lines += words.lines - 1
        stats.htmlWords += markup.words
        stats.paragraphs += markup.paragraphs
      }
      prune(md, usedMd)
      prune(html, usedHtml)
      return stats
    },
  }
}
