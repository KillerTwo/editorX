export const UPLOADING_SCHEME = 'ex-uploading://'
export const FAILED_SCHEME = 'ex-upload-failed://'

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 换行/控制字符会截断行内语法：替换为空格 */
// eslint-disable-next-line no-control-regex
const flatten = (text: string) => text.replace(/[\u0000-\u001f\u007f]+/g, ' ')

export const escapeAlt = (text: string) => flatten(text).replace(/[[\]\\]/g, '\\$&')

/** 空白与控制字符百分号编码，`\ ( ) < >` 反斜杠转义，保证地址停留在 `(...)` 内 */
export const escapeUrl = (url: string) =>
  url
    // eslint-disable-next-line no-control-regex
    .replace(/[\s\u0000-\u001f\u007f]/g, (ch) => encodeURIComponent(ch))
    .replace(/[\\()<>]/g, '\\$&')

export const baseName = (name: string) => name.replace(/\.[^.]+$/, '')

export const imageMarkdown = (name: string, url: string) => `![${escapeAlt(baseName(name))}](${escapeUrl(url)})`
export const uploadingMarkdown = (id: string, label: string) => `![${escapeAlt(label)}](${UPLOADING_SCHEME}${id})`
export const failedMarkdown = (id: string, label: string) => `![${escapeAlt(label)}](${FAILED_SCHEME}${id})`

export function findPlaceholder(markdown: string, id: string): { start: number; end: number } | null {
  const scheme = `(?:${escapeRe(UPLOADING_SCHEME)}|${escapeRe(FAILED_SCHEME)})`
  const re = new RegExp(`!\\[(?:[^\\]\\\\\\n]|\\\\.)*\\]\\(${scheme}${escapeRe(id)}\\)`)
  const match = re.exec(markdown)
  return match ? { start: match.index, end: match.index + match[0].length } : null
}
