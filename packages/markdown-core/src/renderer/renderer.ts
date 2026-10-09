import { splitSections } from '../sections'
import type { RenderedSection, Renderer, RendererOptions, RenderResult } from '../types'
import { collectDefinitions, collectFootnoteDefinitions } from './definitions'
import { assignFootnotes, renderFootnotesHtml } from './footnotes'
import { assignHeadingIds, fillToc } from './headings'
import { createMarkdownIt, resolveRendererOptions } from './markdown-it'
import type { HeadingInfo, RenderEnv } from './md-types'
import { sanitizeHtml } from './sanitize'

interface CachedSection {
  html: string
  headings: HeadingInfo[]
  tocTitles: string[]
  footnoteRefs: string[]
}

export function createRenderer(options?: RendererOptions): Renderer {
  const md = createMarkdownIt(resolveRendererOptions(options))
  let cache = new Map<string, CachedSection>()
  let footnoteCache = new Map<string, string>()

  function renderSource(source: string): CachedSection {
    const env: RenderEnv = {}
    const html = sanitizeHtml(md.render(source, env))
    return {
      html,
      headings: env.exHeadings ?? [],
      tocTitles: env.exTocTitles ?? [],
      footnoteRefs: env.exFootnoteRefs ?? [],
    }
  }

  return {
    render(markdown: string): RenderResult {
      const sources = splitSections(markdown)
      const definitions = collectDefinitions(markdown)
      const nextCache = new Map<string, CachedSection>()
      const rendered = sources.map((section) => {
        const source = definitions ? `${section.text}\n\n${definitions}\n` : section.text
        const entry = nextCache.get(source) ?? cache.get(source) ?? renderSource(source)
        nextCache.set(source, entry)
        return entry
      })
      cache = nextCache

      const withIds = assignHeadingIds(
        rendered.map((entry) => entry.html),
        rendered.map((entry) => entry.headings),
      )
      const toc = withIds.toc
      const withRefs = assignFootnotes(
        withIds.htmls,
        rendered.map((entry) => entry.footnoteRefs),
      )

      const nextFootnoteCache = new Map<string, string>()
      const footnotesHtml = renderFootnotesHtml(withRefs.footnotes, collectFootnoteDefinitions(markdown), (body) => {
        const html = nextFootnoteCache.get(body) ?? footnoteCache.get(body) ?? sanitizeHtml(md.render(body, {}))
        nextFootnoteCache.set(body, html)
        return html
      })
      footnoteCache = nextFootnoteCache

      const lastIndex = sources.length - 1
      const sections: RenderedSection[] = sources.map((section, i) => {
        const html = fillToc(withRefs.htmls[i]!, rendered[i]!.tocTitles, toc)
        return { ...section, html: i === lastIndex ? html + footnotesHtml : html }
      })
      const html = sections
        .map((section, i) => `<div class="ex-preview-section" data-section-index="${i}">${section.html}</div>`)
        .join('')
      return { html, sections, toc }
    },
  }
}
