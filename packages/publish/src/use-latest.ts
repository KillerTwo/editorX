import { useLayoutEffect, useRef, type RefObject } from 'react'

/** 始终指向最近一次提交的值；供 effect/回调读取而不成为依赖 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
