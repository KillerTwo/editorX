import { describe, expect, it } from 'vitest'
import { extractTocTitle } from './toc'

describe('extractTocTitle', () => {
  it('取首个 @[TOC](标题) 的标题；[TOC] 或无标题返回 null', () => {
    expect(extractTocTitle('前言\n@[TOC](这里写自定义目录标题)\n# A')).toBe('这里写自定义目录标题')
    expect(extractTocTitle('@[TOC]\n# A')).toBeNull()
    expect(extractTocTitle('[TOC]')).toBeNull()
    expect(extractTocTitle('正文 @[TOC](x)')).toBeNull()
  })
})
