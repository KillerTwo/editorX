import './prism-manual'
import Prism from 'prismjs'
import 'prismjs/components/prism-typescript.js'
import 'prismjs/components/prism-jsx.js'
import 'prismjs/components/prism-tsx.js'
import 'prismjs/components/prism-bash.js'
import 'prismjs/components/prism-json.js'
import 'prismjs/components/prism-python.js'
import 'prismjs/components/prism-java.js'
import 'prismjs/components/prism-c.js'
import 'prismjs/components/prism-cpp.js'
import 'prismjs/components/prism-csharp.js'
import 'prismjs/components/prism-go.js'
import 'prismjs/components/prism-rust.js'
import 'prismjs/components/prism-sql.js'
import 'prismjs/components/prism-yaml.js'
import 'prismjs/components/prism-markdown.js'
import 'prismjs/components/prism-diff.js'
import { escapeHtml } from './escape'

export function highlightCode(code: string, lang: string): string {
  const name = lang.trim().toLowerCase()
  const grammar = name ? Prism.languages[name] : undefined
  const cls = name ? ` class="language-${escapeHtml(name)}"` : ''
  const body = grammar ? Prism.highlight(code, grammar, name) : escapeHtml(code)
  return `<pre${cls}><code${cls}>${body}</code></pre>\n`
}
