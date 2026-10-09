import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { mergeMessages, zhCN, type DeepPartial, type Messages } from './messages'

const MessagesContext = createContext<Messages>(zhCN)

export interface MessagesProviderProps {
  /** 覆盖部分或全部文案，叠加在外层 Provider（默认 zhCN）之上 */
  messages?: DeepPartial<Messages>
  children: ReactNode
}

export function MessagesProvider({ messages, children }: MessagesProviderProps) {
  const parent = useContext(MessagesContext)
  const value = useMemo(() => mergeMessages(parent, messages), [parent, messages])
  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
}

export function useMessages(): Messages {
  return useContext(MessagesContext)
}
