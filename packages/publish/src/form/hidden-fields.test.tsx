import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { it, expect, vi } from 'vitest'
import { PublishPanel } from '../publish-panel'

const HIDDEN_LABELS = ['创作声明', '文章备份', '文章模板', '多平台发布'] as const

it('hides unused fields and keeps one category', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <PublishPanel
      hiddenFields={['declaration', 'backup', 'template', 'multiPlatform', 'schedule']}
      categorySelection="single"
      onChange={onChange}
      adapters={{
        getCategories: async () => [
          { id: 'a', name: '后端' },
          { id: 'b', name: '前端' },
        ],
        onPublish: async () => {},
      }}
    />,
  )
  expect(await screen.findByRole('checkbox', { name: '后端' })).toBeInTheDocument()
  for (const label of HIDDEN_LABELS) {
    expect(screen.queryByText(label)).not.toBeInTheDocument()
  }
  expect(document.querySelector('[data-action="schedule"]')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /定时发布/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('checkbox', { name: '前端' }))
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ categories: ['b'] }))
})
