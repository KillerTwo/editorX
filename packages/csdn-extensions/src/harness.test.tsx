import type { EditorExtension } from '@geekx/toolbar'
import { render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { extensionCtx, renderExtension } from './test-harness'

const probe: EditorExtension = {
  name: 'probe',
  toolbar: [{ type: 'button', id: 'probe', title: '探针', run: () => {} }],
}

describe('renderExtension', () => {
  it('在 StrictMode 里画出工具栏按钮', () => {
    renderExtension([probe], extensionCtx(), [['probe']])
    expect(screen.getByRole('button', { name: '探针' })).toBeEnabled()
    render(
      <StrictMode>
        <span>mounted</span>
      </StrictMode>,
    )
    expect(screen.getByText('mounted')).toBeInTheDocument()
  })
})
