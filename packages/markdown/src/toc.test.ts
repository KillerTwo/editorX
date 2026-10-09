import { createRenderer } from '@editorx/markdown-core'
import { describe, expect, it, vi } from 'vitest'
import { extractTocTitle } from './toc'

const unescape = (html: string) =>
  html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

/** 渲染器实际输出的目录标题 */
function renderedTitle(markdown: string): string | null {
  const match = /<p class="ex-toc-title">([^<]*)<\/p>/.exec(createRenderer().render(markdown).html)
  return match ? unescape(match[1]!) : null
}

const CASES = [
  '前言\n\n@[TOC](这里写自定义目录标题)\n\n# A',
  '前言\n@[TOC](段落续行)\n# A',
  '# A\n@[TOC](标题之后)',
  '@[toc](小写)\n\n# A',
  '   @[TOC](三个空格)\n\n# A',
  '    @[TOC](缩进代码)\n\n# A',
  '\t@[TOC](制表符)\n\n# A',
  '@[TOC](  两侧空白  ) \n\n# A',
  '@[TOC]()\n\n# A',
  '@[TOC]\n\n# A',
  '[TOC]\n\n# A',
  '正文 @[TOC](x)',
  '> @[TOC](引用)\n\n# A',
  '- @[TOC](列表)\n\n# A',
  '```\n@[TOC](围栏内)\n```\n\n@[TOC](围栏外)\n\n# A',
  '~~~~md\n@[TOC](波浪围栏)\n~~~\n~~~~\n\n# A',
  '```\n@[TOC](未闭合围栏)',
  '@[TOC](第一个)\n\n@[TOC](第二个)\n\n# A',
  '@[TOC](下一行续行)\ntext\n\n# A',
  '@[TOC](setext)\n---\n\n# A',
  '@[TOC](分隔线)\n***\n\n# A',
  '@[TOC](引用打断)\n> q',
  '@[TOC](列表打断)\n- item',
  '@[TOC](围栏打断)\n```\ncode\n```',
  '@[TOC](a &amp; <b>)\n\n# A',
]

describe('extractTocTitle', () => {
  it('取首个独立成段的 @[TOC](标题)；[TOC] 或空标题返回 null', () => {
    expect(extractTocTitle('前言\n\n@[TOC](这里写自定义目录标题)\n# A')).toBe('这里写自定义目录标题')
    expect(extractTocTitle('@[toc](小写)')).toBe('小写')
    expect(extractTocTitle('   @[TOC](缩进)')).toBe('缩进')
    expect(extractTocTitle('```\n@[TOC](围栏内)\n```')).toBeNull()
    expect(extractTocTitle('@[TOC]\n# A')).toBeNull()
    expect(extractTocTitle('[TOC]')).toBeNull()
    expect(extractTocTitle('正文 @[TOC](x)')).toBeNull()
  })

  it('没有 @[TOC]( 标记时不逐行扫描', () => {
    const split = vi.spyOn(String.prototype, 'split')
    expect(extractTocTitle('# A\n\n```js\ncode\n```\n\n正文\n'.repeat(200))).toBeNull()
    expect(split).not.toHaveBeenCalled()
  })

  it('每个围栏只构造一次闭合正则', () => {
    const RealRegExp = RegExp
    const ctor = vi.fn()
    vi.stubGlobal(
      'RegExp',
      new Proxy(RealRegExp, {
        construct(target, args: [string, string?]) {
          ctor()
          return new target(...args)
        },
      }),
    )
    try {
      const fenced = '```js\n' + 'line\n'.repeat(50) + '```\n\n'
      expect(extractTocTitle(fenced + fenced + '@[TOC](标题)\n')).toBe('标题')
      expect(ctor.mock.calls.length).toBeLessThanOrEqual(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it.each(CASES)('与渲染器的目录识别一致：%j', (markdown) => {
    expect(extractTocTitle(markdown)).toBe(renderedTitle(markdown))
  })
})
