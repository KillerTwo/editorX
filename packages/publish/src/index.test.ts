import { describe, expect, it } from 'vitest'
import * as api from './index'

describe('公开 API', () => {
  it('只导出两个外壳、控制器与纯函数，不导出表单/操作栏等内部组件', () => {
    expect(api).toHaveProperty('PublishPanel')
    expect(api).toHaveProperty('PublishModal')
    expect(api).toHaveProperty('usePublishController')
    expect(api).toHaveProperty('validatePublish')
    expect(api).not.toHaveProperty('PublishForm')
    expect(api).not.toHaveProperty('PublishActions')
  })
})
