import {
  errorMessage,
  formatMessage,
  useMessages,
  type AdapterName,
  type CoverMode,
  type EditorAdapters,
  type EditorDocument,
  type MissingAdapterPolicy,
  type PublishOption,
} from '@editorx/toolbar'
import { RadioGroup, Select, type ToastType } from '@editorx/ui'
import { useEffect, useId, useMemo, useRef } from 'react'
import { adapterState } from '../adapter-state'
import { extractImages, extractSummary } from '../extract'
import type { AgreementLinks, PublishVariant } from '../types'
import { useAsyncList } from '../use-async-list'
import type { PublishController } from '../use-publish-controller'
import { CategoryField } from './category-field'
import { CoverField } from './cover-field'
import { FormItem, labelId } from './form-item'
import { ActivityField, ArticleTypeField, BackupField } from './option-fields'
import { SummaryField } from './summary-field'
import { TagField } from './tag-field'

export interface PublishFormProps {
  ctl: PublishController
  variant: PublishVariant
  document?: EditorDocument
  adapters: EditorAdapters
  missingAdapter: MissingAdapterPolicy
  coverModes: readonly CoverMode[]
  templates?: readonly PublishOption[]
  agreementLinks?: AgreementLinks
  notify(message: string, type?: ToastType): void
  /** 已聚焦过的失败次数；由常驻的父组件保存，表单重新挂载（弹窗重开）时不会为旧的失败抢焦点 */
  focusedFailures: number
  onFailuresFocused(count: number): void
}

const VISIBILITIES = ['public', 'private', 'fans', 'vip'] as const
const DECLARATIONS = ['none', 'ai', 'network', 'personal'] as const

export function PublishForm(props: PublishFormProps) {
  const { ctl, variant, document: doc, adapters, missingAdapter, coverModes, templates, agreementLinks, notify } = props
  const { focusedFailures, onFailuresFocused } = props
  const p = useMessages().publish
  const { settings, errors, update, failedAttempts } = ctl
  const rootRef = useRef<HTMLDivElement>(null)
  const baseId = useId()
  const fid = (name: string) => `${baseId}${name}`

  useEffect(() => {
    if (failedAttempts === focusedFailures) return
    // 定时发布弹窗随校验失败关闭时会在微任务里归还焦点，等它之后再聚焦首个错误字段
    const timer = window.setTimeout(() => {
      onFailuresFocused(failedAttempts)
      rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    })
    return () => window.clearTimeout(timer)
  }, [failedAttempts, focusedFailures, onFailuresFocused])

  const state = (name: AdapterName) => adapterState(adapters, name, missingAdapter)
  const categoriesState = state('getCategories')
  const activityState = state('getActivities')
  const topicState = state('getTopics')
  const uploadState = state('uploadImage')
  const loadError = (name: string) => (error: unknown) =>
    notify(formatMessage(p.errors.load, { name, message: errorMessage(error) }), 'error')
  const categories = useAsyncList(
    categoriesState === 'enabled' ? () => adapters.getCategories!() : undefined,
    loadError(p.fields.categories),
  )
  const activities = useAsyncList(
    activityState === 'enabled' ? () => adapters.getActivities!() : undefined,
    loadError(p.fields.activitySub),
  )
  const topics = useAsyncList(topicState === 'enabled' ? () => adapters.getTopics!() : undefined, loadError(p.fields.topicSub))
  const searchTags = useMemo(
    () => (adapters.searchTags ? (keyword: string) => adapters.searchTags!(keyword) : undefined),
    [adapters],
  )
  const uploadImage = useMemo(
    () => (adapters.uploadImage ? (file: File) => adapters.uploadImage!(file) : undefined),
    [adapters],
  )
  const html = doc?.html ?? ''
  const bodyImages = useMemo(() => extractImages(html), [html])
  const summarySource = useMemo(() => extractSummary({ html }), [html])
  const templateOptions = (
    templates ?? [
      { id: 'default', name: p.template.default },
      { id: 'simple', name: p.template.simple },
      { id: 'moyan', name: p.template.moyan, disabled: true },
    ]
  ).map((t) => ({ value: t.id, label: t.name, disabled: t.disabled }))

  return (
    <div ref={rootRef} className="ex-pub-form">
      <FormItem field="tags" id={fid('tags')} label={p.fields.tags} required help={p.help.tags} error={errors.tags}>
        <TagField
          id={fid('tags')}
          tags={settings.tags}
          onChange={(tags) => update('tags', tags)}
          searchTags={searchTags}
          invalid={!!errors.tags}
        />
      </FormItem>
      <FormItem field="cover" id={fid('cover')} label={p.fields.cover} help={p.help.cover} error={errors.cover}>
        <CoverField
          id={fid('cover')}
          cover={settings.cover}
          onChange={(cover) => update('cover', cover)}
          bodyImages={bodyImages}
          modes={coverModes}
          uploadState={uploadState}
          uploadImage={uploadImage}
          variant={variant}
          invalid={!!errors.cover}
          onError={(message) => notify(message, 'error')}
        />
      </FormItem>
      <FormItem field="summary" id={fid('summary')} label={p.fields.summary} help={p.help.summary} error={errors.summary}>
        <SummaryField
          id={fid('summary')}
          value={settings.summary}
          onChange={(summary) => update('summary', summary)}
          source={summarySource}
          variant={variant}
          invalid={!!errors.summary}
        />
      </FormItem>
      {categoriesState !== 'hidden' && (
        <FormItem field="categories" id={fid('cat')} label={p.fields.categories} help={p.help.categories}>
          <CategoryField
            id={fid('cat')}
            value={settings.categories}
            onChange={(ids) => update('categories', ids)}
            categories={categories}
            state={categoriesState}
            variant={variant}
          />
        </FormItem>
      )}
      <FormItem field="articleType" id={fid('type')} label={p.fields.articleType} help={p.help.articleType} error={errors.sourceUrl}>
        <ArticleTypeField
          id={fid('type')}
          value={settings.articleType}
          sourceUrl={settings.sourceUrl}
          onType={(type) => update('articleType', type)}
          onSourceUrl={(url) => update('sourceUrl', url)}
          sourceUrlInvalid={!!errors.sourceUrl}
        />
      </FormItem>
      <FormItem field="declaration" id={fid('decl')} label={p.fields.declaration}>
        <Select
          className="ex-pub-select ex-pub-select--declaration"
          labelledBy={labelId(fid('decl'))}
          value={settings.declaration}
          options={DECLARATIONS.map((value) => ({ value, label: p.declaration[value] }))}
          onChange={(value) => update('declaration', value)}
        />
      </FormItem>
      <FormItem field="backup" id={fid('backup')} label={p.fields.backup}>
        <BackupField
          checked={settings.backupToGitCode}
          onChange={(checked) => update('backupToGitCode', checked)}
          links={agreementLinks}
        />
      </FormItem>
      <FormItem field="visibility" id={fid('vis')} label={p.fields.visibility} help={p.help.visibility}>
        <RadioGroup
          className="ex-pub-line"
          labelledBy={labelId(fid('vis'))}
          value={settings.visibility}
          options={VISIBILITIES.map((value) => ({ value, label: p.visibility[value] }))}
          onChange={(value) => update('visibility', value)}
        />
      </FormItem>
      <FormItem field="template" id={fid('tpl')} label={p.fields.template} help={p.help.template}>
        <RadioGroup
          className="ex-pub-line"
          labelledBy={labelId(fid('tpl'))}
          value={settings.template}
          options={templateOptions}
          onChange={(value) => update('template', value)}
        />
      </FormItem>
      <FormItem field="multiPlatform" id={fid('multi')} label={p.fields.multiPlatform}>
        <RadioGroup<'no' | 'yes'>
          className="ex-pub-line"
          labelledBy={labelId(fid('multi'))}
          value={settings.multiPlatform ? 'yes' : 'no'}
          options={[
            { value: 'no', label: p.multiPlatform.no },
            { value: 'yes', label: p.multiPlatform.yes },
          ]}
          onChange={(value) => update('multiPlatform', value === 'yes')}
        />
      </FormItem>
      {(activityState !== 'hidden' || topicState !== 'hidden') && (
        <FormItem
          field="activity"
          id={fid('act')}
          label={p.fields.activity}
          labelSuffix={p.fields.activitySuffix}
          help={p.help.activity}
        >
          <ActivityField
            id={fid('act')}
            activityId={settings.activityId}
            topicId={settings.topicId}
            onActivity={(id) => update('activityId', id)}
            onTopic={(id) => update('topicId', id)}
            activities={activities}
            topics={topics}
            activityState={activityState}
            topicState={topicState}
          />
        </FormItem>
      )}
    </div>
  )
}
