import { useEffect, useState } from 'react'
import { useLatest } from './use-latest'

/** 未启用（load 为 undefined）返回 []，加载中返回 null；启用状态变化时重新加载 */
export function useAsyncList<T>(load: (() => Promise<T[]>) | undefined, onError: (error: unknown) => void): T[] | null {
  const enabled = load !== undefined
  const [items, setItems] = useState<T[] | null>(enabled ? null : [])
  const [wasEnabled, setWasEnabled] = useState(enabled)
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled)
    setItems(enabled ? null : [])
  }
  const loadRef = useLatest(load)
  const onErrorRef = useLatest(onError)

  useEffect(() => {
    const run = loadRef.current
    if (!run) return
    let live = true
    run().then(
      (list) => {
        if (live) setItems(list)
      },
      (error: unknown) => {
        if (!live) return
        setItems([])
        onErrorRef.current(error)
      },
    )
    return () => {
      live = false
    }
  }, [enabled, loadRef, onErrorRef])

  return items
}
