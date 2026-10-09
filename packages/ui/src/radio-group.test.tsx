import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RadioGroup, type RadioOption } from './radio-group'
import { renderWithTheme } from './test-utils'

type Kind = 'a' | 'b' | 'c'
const options: RadioOption<Kind>[] = [
  { value: 'a', label: '甲' },
  { value: 'b', label: '乙' },
  { value: 'c', label: '丙', disabled: true },
]

function Controlled({ onChange }: { onChange?: (v: Kind) => void }) {
  const [value, setValue] = useState<Kind>('a')
  return (
    <RadioGroup<Kind>
      label="类型"
      value={value}
      options={options}
      onChange={(v) => {
        setValue(v)
        onChange?.(v)
      }}
    />
  )
}

describe('RadioGroup', () => {
  it('渲染 radiogroup 与同名原生单选，选中项带 is-checked', () => {
    renderWithTheme(<Controlled />)
    expect(screen.getByRole('radiogroup', { name: '类型' })).toHaveClass('ex-radio-group')
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(new Set(radios.map((r) => r.getAttribute('name'))).size).toBe(1)
    expect(screen.getByRole('radio', { name: '甲' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '甲' }).closest('label')).toHaveClass('ex-radio', 'is-checked')
  })

  it('点击文字切换并回调；禁用项不可选', async () => {
    const onChange = vi.fn()
    renderWithTheme(<Controlled onChange={onChange} />)
    await userEvent.click(screen.getByText('乙'))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.getByRole('radio', { name: '乙' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '丙' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: '丙' }).closest('label')).toHaveClass('is-disabled')
    await userEvent.click(screen.getByText('丙'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('整组禁用、invalid 与 labelledBy', () => {
    renderWithTheme(
      <>
        <span id="lbl">可见范围</span>
        <RadioGroup labelledBy="lbl" value="a" options={options} onChange={() => {}} disabled invalid />
      </>,
    )
    expect(screen.getByRole('radiogroup', { name: '可见范围' })).toHaveAttribute('aria-invalid', 'true')
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
  })
})
