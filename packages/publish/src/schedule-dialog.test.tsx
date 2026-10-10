import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScheduleDialog, type ScheduleDialogProps } from './schedule-dialog'
import { renderWithProviders } from './test-utils'

const HINT = '请选择当前时间后 4小时 至 7天 进行定时发布'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 9, 12, 0))
})
afterEach(() => vi.useRealTimers())

function open(props: Partial<ScheduleDialogProps> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  renderWithProviders(<ScheduleDialog onConfirm={onConfirm} onCancel={onCancel} {...props} />)
  return { onConfirm, onCancel, dialog: screen.getByRole('dialog', { name: '定时发布' }) }
}

async function openCalendar(dialog: HTMLElement) {
  await userEvent.click(within(dialog).getByRole('button', { name: '发布日期' }))
  return screen.findByRole('dialog', { name: '发布日期' })
}

async function pick(dialog: HTMLElement, date: string, time: string) {
  await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: date }))
  await userEvent.click(within(dialog).getByRole('combobox', { name: '发布时间' }))
  await userEvent.click(await screen.findByRole('option', { name: time }))
}

describe('ScheduleDialog', () => {
  it('提示、按钮文案、遮罩；未选日期时时间框禁用，确认按钮仍可点（B25–B28）', () => {
    const { dialog } = open()
    expect(dialog).toHaveClass('ex-pub-schedule')
    expect(document.querySelector('.ex-pub-schedule-mask')).not.toBeNull()
    expect(within(dialog).getByText(HINT)).toHaveClass('ex-pub-schedule__hint')
    expect(within(dialog).getByRole('button', { name: '取 消' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: '定时发布' })).toBeEnabled()
    expect(within(dialog).getByRole('combobox', { name: '发布时间' })).toBeDisabled()
    expect(within(dialog).getByRole('combobox', { name: '发布时间' })).toHaveTextContent('选择时间')
    expect(within(dialog).getByRole('button', { name: '发布日期' })).toHaveTextContent('选择日期')
  })

  it('未选日期 / 时间时点确认：不提交，提示行变为错误并 role=alert；选择后恢复普通提示', async () => {
    const { dialog, onConfirm } = open()
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveClass('ex-pub-schedule__error')
    expect(alert).toHaveTextContent(HINT)
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-10' }))
    expect(within(dialog).queryByRole('alert')).toBeNull()
    expect(within(dialog).getByText(HINT)).toHaveClass('ex-pub-schedule__hint')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('所选时刻在点击时已越界（时间流逝）：不提交并显示错误，已过期的时间档随之禁用', async () => {
    const { dialog, onConfirm } = open()
    await pick(dialog, '2026-10-09', '16:00')
    vi.setSystemTime(new Date(2026, 9, 9, 12, 1))
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(HINT)
    expect(onConfirm).not.toHaveBeenCalled()
    const time = within(dialog).getByRole('combobox', { name: '发布时间' })
    expect(time).toHaveTextContent('选择时间')
    await userEvent.click(time)
    expect(await screen.findByRole('option', { name: '16:00' })).toBeDisabled()
    expect(screen.getByRole('option', { name: '16:30' })).toBeEnabled()
  })

  it('日期 min / max：今天到 7 天后可选，之外禁用', async () => {
    const { dialog } = open()
    const calendar = await openCalendar(dialog)
    expect(within(calendar).getByRole('button', { name: '2026-10-08' })).toBeDisabled()
    expect(within(calendar).getByRole('button', { name: '2026-10-09' })).toBeEnabled()
    expect(within(calendar).getByRole('button', { name: '2026-10-16' })).toBeEnabled()
    expect(within(calendar).getByRole('button', { name: '2026-10-17' })).toBeDisabled()
  })

  it('时间档按所选日期禁用：当天 16:00 起，第 7 天 12:00 止', async () => {
    const { dialog } = open()
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-09' }))
    await userEvent.click(within(dialog).getByRole('combobox', { name: '发布时间' }))
    expect(await screen.findByRole('option', { name: '15:30' })).toBeDisabled()
    expect(screen.getByRole('option', { name: '16:00' })).toBeEnabled()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-16' }))
    await userEvent.click(within(dialog).getByRole('combobox', { name: '发布时间' }))
    expect(await screen.findByRole('option', { name: '12:00' })).toBeEnabled()
    expect(screen.getByRole('option', { name: '12:30' })).toBeDisabled()
  })

  it('选择日期与时间后确认，回传 ISO', async () => {
    const { dialog, onConfirm } = open()
    await pick(dialog, '2026-10-10', '10:00')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(onConfirm).toHaveBeenCalledWith(new Date(2026, 9, 10, 10, 0).toISOString())
    expect(within(dialog).queryByRole('alert')).toBeNull()
  })

  it('改选日期后原时间越界：时间视为未选，点确认不提交', async () => {
    const { dialog, onConfirm } = open()
    await pick(dialog, '2026-10-09', '16:00')
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-16' }))
    expect(within(dialog).getByRole('combobox', { name: '发布时间' })).toHaveTextContent('选择时间')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('改选到时间不可用的日期会清空时间，再改回可用日期也不恢复', async () => {
    const { dialog, onConfirm } = open()
    await pick(dialog, '2026-10-10', '10:00')
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-09' }))
    const time = within(dialog).getByRole('combobox', { name: '发布时间' })
    expect(time).toHaveTextContent('选择时间')
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-11' }))
    expect(time).toHaveTextContent('选择时间')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('确认失败刷新当前时间后清空过期的时间，改选其他日期也不恢复', async () => {
    const { dialog, onConfirm } = open()
    await pick(dialog, '2026-10-09', '16:00')
    vi.setSystemTime(new Date(2026, 9, 9, 12, 1))
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-10' }))
    expect(within(dialog).getByRole('combobox', { name: '发布时间' })).toHaveTextContent('选择时间')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('确认失败刷新后所选日期已不可选：日期视为未选，时间框禁用', async () => {
    vi.setSystemTime(new Date(2026, 9, 9, 19, 0))
    const { dialog, onConfirm } = open()
    await pick(dialog, '2026-10-09', '23:30')
    vi.setSystemTime(new Date(2026, 9, 9, 19, 45))
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: '发布日期' })).toHaveTextContent('选择日期')
    const time = within(dialog).getByRole('combobox', { name: '发布时间' })
    expect(time).toBeDisabled()
    expect(time).toHaveTextContent('选择时间')
    const calendar = await openCalendar(dialog)
    expect(within(calendar).getByRole('button', { name: '2026-10-09' })).toBeDisabled()
    expect(within(calendar).getByRole('button', { name: '2026-10-10' })).toBeEnabled()
  })

  it('确认失败后选择时间：错误恢复为普通提示', async () => {
    const { dialog } = open()
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-10' }))
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('combobox', { name: '发布时间' }))
    await userEvent.click(await screen.findByRole('option', { name: '10:00' }))
    expect(within(dialog).queryByRole('alert')).toBeNull()
    expect(within(dialog).getByText(HINT)).toHaveClass('ex-pub-schedule__hint')
  })

  it('提示行通过 aria-describedby 关联两个选择器；无效时标记 aria-invalid', async () => {
    const { dialog } = open()
    const date = within(dialog).getByRole('button', { name: '发布日期' })
    const time = within(dialog).getByRole('combobox', { name: '发布时间' })
    expect(date).toHaveAccessibleDescription(`选择日期 ${HINT}`)
    expect(time).toHaveAccessibleDescription(HINT)
    expect(date).not.toHaveAttribute('aria-invalid')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(date).toHaveAccessibleDescription(`选择日期 ${HINT}`)
    expect(date).toHaveAttribute('aria-invalid', 'true')
    expect(time).not.toHaveAttribute('aria-invalid')
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-10' }))
    expect(date).not.toHaveAttribute('aria-invalid')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(date).not.toHaveAttribute('aria-invalid')
    expect(time).toHaveAttribute('aria-invalid', 'true')
    expect(time).toHaveAccessibleDescription(HINT)
  })

  it('重复确认失败时错误节点重新挂载，读屏会再次播报', async () => {
    const { dialog } = open()
    const confirm = within(dialog).getByRole('button', { name: '定时发布' })
    await userEvent.click(confirm)
    const first = within(dialog).getByRole('alert')
    await userEvent.click(confirm)
    const second = within(dialog).getByRole('alert')
    expect(second).not.toBe(first)
    expect(first).not.toBeInTheDocument()
  })

  it('宿主错误：选择变化时回调 onChange；空选确认显示区间提示而不是宿主文案', async () => {
    const onChange = vi.fn()
    const { dialog } = open({ error: '该时段不可发布', onChange })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('该时段不可发布')
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(HINT)
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.click(within(await openCalendar(dialog)).getByRole('button', { name: '2026-10-10' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    await userEvent.click(within(dialog).getByRole('combobox', { name: '发布时间' }))
    await userEvent.click(await screen.findByRole('option', { name: '10:00' }))
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('errorKey 变化时宿主错误节点重新挂载', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const { rerender } = renderWithProviders(
      <ScheduleDialog error="该时段不可发布" errorKey={1} onConfirm={onConfirm} onCancel={onCancel} />,
    )
    const first = screen.getByRole('alert')
    rerender(<ScheduleDialog error="该时段不可发布" errorKey={2} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByRole('alert')).not.toBe(first)
  })

  it('区间内没有可用时间档：日期框禁用，点确认不提交并显示错误', async () => {
    const { dialog, onConfirm } = open({ range: { minOffsetMs: 60_000, maxOffsetMs: 120_000 } })
    expect(within(dialog).getByRole('button', { name: '发布日期' })).toBeDisabled()
    expect(within(dialog).getByRole('combobox', { name: '发布时间' })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('button', { name: '定时发布' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('请选择当前时间后 1分钟 至 2分钟 进行定时发布')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('error 替换提示并 role=alert；busy 时确认 loading', () => {
    const { dialog } = open({ error: HINT, busy: true })
    const alert = within(dialog).getByRole('alert')
    expect(alert).toHaveClass('ex-pub-schedule__error')
    expect(dialog.querySelector('.ex-pub-schedule__hint')).toBeNull()
    expect(within(dialog).getByRole('button', { name: '定时发布' })).toHaveAttribute('aria-busy', 'true')
  })

  it('range 覆盖提示与可选区间；取消回调', async () => {
    const { dialog, onCancel } = open({ range: { minOffsetMs: 0, maxOffsetMs: 24 * 3_600_000 } })
    expect(within(dialog).getByText('请选择当前时间后 0分钟 至 1天 进行定时发布')).toBeInTheDocument()
    const calendar = await openCalendar(dialog)
    expect(within(calendar).getByRole('button', { name: '2026-10-10' })).toBeEnabled()
    expect(within(calendar).getByRole('button', { name: '2026-10-11' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(within(dialog).getByRole('button', { name: '取 消' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('无效 range（下限大于上限）按默认区间提示', () => {
    const { dialog } = open({ range: { minOffsetMs: 2 * 3_600_000, maxOffsetMs: 3_600_000 } })
    expect(within(dialog).getByText(HINT)).toBeInTheDocument()
  })
})
