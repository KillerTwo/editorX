import type { EmbedDef } from '../types'
import { encodeBase64Utf8 } from './base64'
import { escapeHtml } from './escape'

export const EMBED_FENCE_PREFIX = 'ex-embed:'

export function renderMermaidPlaceholder(source: string): string {
  return `<div class="ex-mermaid" data-ex-diagram="${encodeBase64Utf8(source)}"></div>\n`
}

const FLOWCHART_HEADER = /^\s*flowchart[ \t]*\r?\n/
const FLOWCHART_JS_NODE =
  /^[\w-]+=>(?:start|end|operation|subroutine|condition|inputoutput|parallel|input|output)\b/

export function isFlowchartJs(src: string): boolean {
  const lines = src
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const [first, ...rest] = lines
  if (first === undefined) return false
  if (first === 'flowchart') return rest.some((line) => FLOWCHART_JS_NODE.test(line))
  return FLOWCHART_JS_NODE.test(first)
}

export function stripFlowchartHeader(src: string): string {
  return src.replace(FLOWCHART_HEADER, '')
}

export function renderFlowchartPlaceholder(source: string): string {
  return `<div class="ex-flowchart" data-ex-diagram="${encodeBase64Utf8(stripFlowchartHeader(source))}"></div>\n`
}

export function renderEmbedFence(type: string, raw: string, embeds: Map<string, EmbedDef>): string {
  const def = embeds.get(type)
  if (def) {
    try {
      const payload: unknown = JSON.parse(raw)
      const inner = def.renderHtml(payload)
      return `<div class="ex-embed" data-ex-embed="${escapeHtml(type)}" data-ex-payload="${encodeBase64Utf8(raw.trim())}">${inner}</div>\n`
    } catch {
      // invalid JSON or a throwing embed renderer degrades to a plain code block
    }
  }
  // keep the type's original case so the fence can be restored verbatim from the class
  const cls = ` class="language-${escapeHtml(EMBED_FENCE_PREFIX + type)}"`
  return `<pre${cls}><code${cls}>${escapeHtml(raw)}</code></pre>\n`
}
