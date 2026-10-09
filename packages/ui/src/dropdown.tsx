import type { Placement } from '@floating-ui/react'
import type { ReactElement, ReactNode } from 'react'
import { Popover } from './popover'

export interface DropdownItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

export interface DropdownProps {
  items: DropdownItem[]
  onSelect: (key: string) => void
  children: ReactElement<Record<string, unknown>>
  placement?: Placement
}

export function Dropdown({ items, onSelect, children, placement = 'bottom-start' }: DropdownProps) {
  return (
    <Popover
      placement={placement}
      className="ex-dropdown"
      content={(close) => (
        <ul role="menu" className="ex-dropdown__menu">
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitem"
                className="ex-dropdown__item"
                disabled={item.disabled}
                onClick={() => {
                  onSelect(item.key)
                  close()
                }}
              >
                {item.icon && <span className="ex-dropdown__icon" aria-hidden="true">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    >
      {children}
    </Popover>
  )
}
