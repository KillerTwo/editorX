import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { mergeMessages, zhCN, type DeepPartial, type Messages } from './messages'

const MessagesContext = createContext<Messages>(zhCN)

export interface MessagesProviderProps {
  /**
   * 覆盖部分或全部文案，叠加在外层 Provider（默认 zhCN）之上。
   * 按对象引用缓存合并结果：请传稳定引用（模块常量或 useMemo），内联对象每次渲染都会重新合并，
   * 并让所有 useMessages 使用方重新渲染。
   */
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
