import DOMPurify, { type Config } from 'dompurify'

let instance: typeof DOMPurify | null = null

function purifier(): typeof DOMPurify {
  if (!instance) {
    if (typeof window === 'undefined') {
      throw new Error('[editorx/markdown-core] HTML sanitization requires a DOM (browser or jsdom)')
    }
    instance = DOMPurify(window)
  }
  return instance
}

const HTML_CONFIG: Config = {
  ADD_TAGS: ['semantics', 'annotation'],
  ADD_ATTR: ['target', 'encoding'],
  FORBID_TAGS: ['style'],
}

const SVG_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true, html: true },
  ADD_TAGS: ['foreignObject'],
  FORBID_TAGS: ['script', 'style'],
}

// mermaid scopes its theme/classDef CSS in an inner <style>, so it must survive
const MERMAID_SVG_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true, html: true },
  ADD_TAGS: ['foreignObject', 'style'],
  FORBID_TAGS: ['script'],
}

export function sanitizeHtml(html: string): string {
  return String(purifier().sanitize(html, HTML_CONFIG))
}

export function sanitizeSvg(svg: string): string {
  return String(purifier().sanitize(svg, SVG_CONFIG))
}

export function sanitizeMermaidSvg(svg: string): string {
  return String(purifier().sanitize(svg, MERMAID_SVG_CONFIG))
}
