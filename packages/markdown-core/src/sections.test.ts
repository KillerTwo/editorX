import { describe, expect, it } from 'vitest'
import { splitSections } from './sections'

const texts = (md: string) => splitSections(md).map((s) => s.text)

function expectContiguous(md: string) {
  const sections = splitSections(md)
  expect(sections.length).toBeGreaterThan(0)
  expect(sections[0]!.start).toBe(0)
  expect(sections[sections.length - 1]!.end).toBe(md.length)
  sections.forEach((s, i) => {
    if (i > 0) expect(s.start).toBe(sections[i - 1]!.end)
    expect(s.text).toBe(md.slice(s.start, s.end))
  })
}

describe('splitSections', () => {
  it('returns one empty section for empty input', () => {
    expect(splitSections('')).toEqual([{ text: '', start: 0, end: 0 }])
  })

  it('keeps text without headings in a single section', () => {
    expect(texts('hello\n\nworld\n')).toEqual(['hello\n\nworld\n'])
  })

  it('starts a section at every ATX heading', () => {
    expect(texts('# A\npara\n## B\ntext')).toEqual(['# A\npara\n', '## B\ntext'])
  })

  it('keeps leading text before the first heading as its own section', () => {
    expect(texts('intro\n# A\n')).toEqual(['intro\n', '# A\n'])
  })

  it('requires a space after ATX hashes', () => {
    expect(texts('a\n#hashtag\n####### seven\n')).toEqual(['a\n#hashtag\n####### seven\n'])
  })

  it('starts a section at setext headings (at the paragraph start)', () => {
    expect(texts('intro\n\nTitle\n===\nbody\n\nSub\n---\nx')).toEqual([
      'intro\n\n',
      'Title\n===\nbody\n\n',
      'Sub\n---\nx',
    ])
  })

  it('does not treat a thematic break after a blank line as setext', () => {
    expect(texts('a\n\n---\n\nb')).toEqual(['a\n\n---\n\nb'])
  })

  it('does not treat list items or quotes as setext heading text', () => {
    expect(texts('- item\n---\n> quote\n---\n')).toEqual(['- item\n---\n> quote\n---\n'])
  })

  it('never splits inside backtick fences', () => {
    expect(texts('# A\n```\n# not heading\nfoo\n===\n```\n## B')).toEqual([
      '# A\n```\n# not heading\nfoo\n===\n```\n',
      '## B',
    ])
  })

  it('only closes a fence with the same char and at least the same length', () => {
    expect(texts('~~~~\n# x\n~~~\n```\n# y\n~~~~\n# z')).toEqual([
      '~~~~\n# x\n~~~\n```\n# y\n~~~~\n',
      '# z',
    ])
  })

  it('treats an unclosed fence as running to the end', () => {
    expect(texts('# A\n```js\n# b\n# c')).toEqual(['# A\n```js\n# b\n# c'])
  })

  it('does not open a backtick fence whose info string contains a backtick', () => {
    expect(texts('```a`b\n# H\n')).toEqual(['```a`b\n', '# H\n'])
  })

  it('handles CRLF line endings', () => {
    expect(texts('# A\r\nx\r\n\r\nT\r\n===\r\n')).toEqual(['# A\r\nx\r\n\r\n', 'T\r\n===\r\n'])
  })

  it('produces contiguous sections covering the whole text', () => {
    for (const md of [
      '',
      '# only',
      '\n\n# A\n\n',
      'p\n# A\n```\n# x\n```\n## B\nT\n---\n',
      '# A\n# B\n# C',
    ]) {
      expectContiguous(md)
    }
  })
})
