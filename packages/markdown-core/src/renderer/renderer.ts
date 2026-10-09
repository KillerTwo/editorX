import { splitSections } from '../sections'
import type { RenderedSection, Renderer, RendererOptions, RenderResult } from '../types'
import {
  collectDefinitions,
  collectFootnoteDefinitions,
  type DefinitionEnv,
  definitionsUsedBy,
  joinDefinitions,
  parseDefinitions,
  seedEnv,
} from './definitions'
import { assignFootnotes, renderFootnotesHtml, resolveBodyFootnoteRefs } from './footnotes'
import { assignHeadingIds, fillToc, stripHeadingPlaceholders } from './headings'
import { createMarkdownIt, resolveRendererOptions } from './markdown-it'
import type { HeadingInfo, RenderEnv } from './md-types'
import { sanitizeHtml } from './sanitize'

interface CachedSection {
  html: string
  headings: HeadingInfo[]
  tocTitles: string[]
  footnoteRefs: string[]
}

interface CachedFootnoteBody {
  html: string
  footnoteRefs: string[]
}

export function createRenderer(options?: RendererOptions): Renderer {
  const md = createMarkdownIt(resolveRendererOptions(options))
  let cache = new Map<string, CachedSection>()
  let footnoteCache = new Map<string, CachedFootnoteBody>()
  let usedByDefinitions = ''
  let usedByCache = new Map<string, string>()

  function renderWithDefinitions(source: string, defs: DefinitionEnv): { html: string; env: RenderEnv } {
    const env: RenderEnv = seedEnv(defs)
    return { html: sanitizeHtml(md.render(source, env)), env }
  }

  function renderSection(source: string, defs: DefinitionEnv): CachedSection {
    const { html, env } = renderWithDefinitions(source, defs)
    return {
      html,
      headings: env.exHeadings ?? [],
      tocTitles: env.exTocTitles ?? [],
      footnoteRefs: env.exFootnoteRefs ?? [],
    }
  }

  function renderFootnoteBody(body: string, defs: DefinitionEnv): CachedFootnoteBody {
    const { html, env } = renderWithDefinitions(body, defs)
    return { html: stripHeadingPlaceholders(html), footnoteRefs: env.exFootnoteRefs ?? [] }
  }

  return {
    render(markdown: string): RenderResult {
      const sources = splitSections(markdown)
      const definitions = collectDefinitions(markdown)
      let defs: DefinitionEnv | undefined
      const allDefinitions = joinDefinitions(definitions)
      const definitionEnv = () => (defs ??= parseDefinitions(md, allDefinitions))
      // Unchanged sections reuse their used-definitions key while the document's definitions are unchanged.
      const previousUsedBy = allDefinitions === usedByDefinitions ? usedByCache : new Map<string, string>()
      const nextUsedBy = new Map<string, string>()
      const cacheKey = (text: string) => {
        let used = nextUsedBy.get(text) ?? previousUsedBy.get(text)
        if (used === undefined) used = definitionsUsedBy(text, definitions)
        nextUsedBy.set(text, used)
        return `${used}\u0000${text}`
      }

      const nextCache = new Map<string, CachedSection>()
      const rendered = sources.map((section) => {
        const key = cacheKey(section.text)
        const entry = nextCache.get(key) ?? cache.get(key) ?? renderSection(section.text, definitionEnv())
        nextCache.set(key, entry)
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

      const nextFootnoteCache = new Map<string, CachedFootnoteBody>()
      const footnoteDefinitions = withRefs.footnotes.length > 0 ? collectFootnoteDefinitions(markdown) : new Map<string, string>()
      const footnotesHtml = renderFootnotesHtml(withRefs.footnotes, footnoteDefinitions, (body) => {
        const key = cacheKey(body)
        const entry = nextFootnoteCache.get(key) ?? footnoteCache.get(key) ?? renderFootnoteBody(body, definitionEnv())
        nextFootnoteCache.set(key, entry)
        return resolveBodyFootnoteRefs(entry.html, entry.footnoteRefs, withRefs.footnotes)
      })
      footnoteCache = nextFootnoteCache
      usedByDefinitions = allDefinitions
      usedByCache = nextUsedBy

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
