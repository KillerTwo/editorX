import { describe, expect, it } from 'vitest'
import { countRichTextChars } from './count'

describe('countRichTextChars', () => {
  it('字数不计空格和零宽字符，不计 script', () => {
    expect(countRichTextChars('<p>12312312312</p>')).toBe(11)
    expect(countRichTextChars('<p>a b</p>')).toBe(2)
    expect(countRichTextChars('<p>a\u200Bb\u200Cc\u200Dd\u2060e\uFEFFf</p>')).toBe(6)
    expect(countRichTextChars('<script>secret</script><p>ab</p>')).toBe(2)
    expect(countRichTextChars('<p> </p>')).toBe(0)
  })
})
