import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(path.join(import.meta.dirname, p), 'utf8').replace(/\r\n/g, '\n')
const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const themeCss = read('../../theme/src/styles.css')

describe('ui styles.css', () => {
  it('只引用 theme 中已定义的 --ex-* 变量', () => {
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!))
    for (const name of used) expect(themeCss, name).toContain(`${name}:`)
  })

  it('不写死颜色值', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|light-dark\(/)
  })

  it('单选、复选、下拉、裁剪控件有样式', () => {
    for (const cls of ['ex-radio', 'ex-radio__dot', 'ex-checkbox', 'ex-checkbox__box', 'ex-select', 'ex-select__option', 'ex-cropper__viewport']) {
      expect(css, cls).toMatch(new RegExp(`\\.${cls}(?![\\w-])`))
    }
  })
})
