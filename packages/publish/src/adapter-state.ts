import type { AdapterName, EditorAdapters, MissingAdapterPolicy } from '@geekx/toolbar'

export type AdapterState = 'enabled' | 'disabled' | 'hidden'

export function adapterState(adapters: EditorAdapters, name: AdapterName, policy: MissingAdapterPolicy): AdapterState {
  if (typeof adapters[name] === 'function') return 'enabled'
  return policy === 'disable' ? 'disabled' : 'hidden'
}
