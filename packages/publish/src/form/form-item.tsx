import { useMessages } from '@editorx/toolbar'
import { Tooltip } from '@editorx/ui'
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { cx } from '../cx'
import { HelpIcon } from '../icons'

export const labelId = (id: string) => `${id}-label`
export const errorId = (id: string) => `${id}-error`

export interface FormItemProps {
  /** 根元素 data-field，供样式与测试定位 */
  field: string
  /** useId() 前缀：标签 id 为 `${id}-label`，错误 id 为 `${id}-error` */
  id: string
  label: ReactNode
  /** 帮助图标之后的标签文字（CSDN「参与活动 ⓘ /话题」） */
  labelSuffix?: ReactNode
  required?: boolean
  help?: string
  error?: string
  children: ReactNode
}

export function FormItem({ field, id, label, labelSuffix, required, help, error, children }: FormItemProps) {
  const helpName = useMessages().publish.a11y.help
  const control =
    required && isValidElement(children)
      ? cloneElement(children as ReactElement<{ 'aria-required'?: boolean }>, { 'aria-required': true })
      : children
  return (
    <div className={cx('ex-pub-item', error && 'is-error')} data-field={field}>
      <div className="ex-pub-item__label">
        {required && (
          <span className="ex-pub-item__required" aria-hidden="true">
            *
          </span>
        )}
        <span className="ex-pub-item__text" id={labelId(id)}>
          {label}
        </span>
        {help && (
          <Tooltip content={help} placement="top">
            <button type="button" className="ex-pub-item__help" aria-label={helpName}>
              <HelpIcon />
            </button>
          </Tooltip>
        )}
        {labelSuffix && <span className="ex-pub-item__suffix">{labelSuffix}</span>}
      </div>
      <div className="ex-pub-item__control">
        {control}
        {error && (
          <div className="ex-pub-item__error" id={errorId(id)}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
