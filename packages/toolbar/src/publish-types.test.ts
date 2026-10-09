import { describe, expectTypeOf, it } from 'vitest'
import type {
  ArticleType,
  Category,
  CoverMode,
  CreationDeclaration,
  EditorAdapters,
  EditorDocument,
  PublishOption,
  PublishPayload,
  PublishSettings,
  Visibility,
} from './index'

describe('发布相关共享类型（typecheck 期断言）', () => {
  it('PublishSettings 字段与取值', () => {
    expectTypeOf<CoverMode>().toEqualTypeOf<'single' | 'triple' | 'none'>()
    expectTypeOf<ArticleType>().toEqualTypeOf<'original' | 'reprint' | 'translated'>()
    expectTypeOf<Visibility>().toEqualTypeOf<'public' | 'private' | 'fans' | 'vip'>()
    expectTypeOf<CreationDeclaration>().toEqualTypeOf<'none' | 'ai' | 'network' | 'personal'>()
    expectTypeOf<PublishSettings['tags']>().toEqualTypeOf<string[]>()
    expectTypeOf<PublishSettings['cover']>().toEqualTypeOf<{ mode: CoverMode; urls: string[] }>()
    expectTypeOf<PublishSettings['categories']>().toEqualTypeOf<string[]>()
    expectTypeOf<PublishSettings['backupToGitCode']>().toEqualTypeOf<boolean>()
    expectTypeOf<PublishSettings['multiPlatform']>().toEqualTypeOf<boolean>()
    expectTypeOf<PublishSettings['template']>().toEqualTypeOf<string>()
    expectTypeOf<PublishSettings['sourceUrl']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<PublishSettings['activityId']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<PublishSettings['scheduledAt']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<Category>().toEqualTypeOf<{ id: string; name: string }>()
    expectTypeOf<PublishOption>().toEqualTypeOf<{ id: string; name: string; disabled?: boolean }>()
  })

  it('PublishPayload = EditorDocument & PublishSettings', () => {
    expectTypeOf<PublishPayload>().toEqualTypeOf<EditorDocument & PublishSettings>()
  })

  it('EditorAdapters：getActivities/getTopics 与带 settings 的 onSaveDraft', () => {
    expectTypeOf<NonNullable<EditorAdapters['getActivities']>>().returns.toEqualTypeOf<Promise<PublishOption[]>>()
    expectTypeOf<NonNullable<EditorAdapters['getTopics']>>().returns.toEqualTypeOf<Promise<PublishOption[]>>()
    expectTypeOf<NonNullable<EditorAdapters['onSaveDraft']>>().parameters.toEqualTypeOf<
      [doc: EditorDocument, settings?: PublishSettings]
    >()
    expectTypeOf<NonNullable<EditorAdapters['onPublish']>>().parameters.toEqualTypeOf<[payload: PublishPayload]>()
  })
})
