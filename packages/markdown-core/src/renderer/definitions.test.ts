import { describe, expect, it } from 'vitest'
import { collectDefinitions, definitionsUsedBy, joinDefinitions, normalizeLabel } from './definitions'

function naive(text: string, md: string): string {
  const entries = collectDefinitions(md)
  const labels = normalizeLabel(text.replace(/\n[ \t>]*/g, ' ')).replace(/\[ /g, '[')
  return joinDefinitions(
    entries.filter((entry) =>
      entry.kind === 'abbr'
        ? text.includes(entry.key)
        : labels.includes(entry.kind === 'footnote' ? `[^${entry.key}` : `[${entry.key}`),
    ),
  )
}

const DEFS = [
  '[a]: https://a.example',
  '[ab]: https://ab.example',
  '[Foo  Bar]: https://foo.example',
  '[ref-12]: https://ref.example/12',
  '[ref-1]: https://ref.example/1',
  '*[HTML]: Hyper Text',
  '[^note]: 脚注',
  '[^n]: 短脚注',
].join('\n\n')

describe('definitionsUsedBy', () => {
  it.each([
    ['无引用', 'plain text'],
    ['前缀过度包含：[ab] 同时带出 a', 'see [ab] here'],
    ['大小写与空白折叠', 'see [foo\n> bar][FOO BAR]'],
    ['ref-1 是 ref-12 的前缀', 'x [链接][ref-12] y'],
    ['脚注只匹配 [^ 前缀', 'note[^note] and [^n]'],
    ['缩写', 'HTML and [a]'],
    ['行首续行标记被折叠', '[\n> a]'],
  ])('%s：与逐条子串匹配结果一致', (_name, text) => {
    expect(definitionsUsedBy(text, collectDefinitions(DEFS))).toBe(naive(text, DEFS))
  })

  it('没有定义时返回空串', () => {
    expect(definitionsUsedBy('[a]', [])).toBe('')
  })
})
