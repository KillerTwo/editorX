import { useEffect, useRef } from 'react'
import type { EditorExtension, ExtensionContext } from './extension'

/** 元素逐个 === 时返回上一次的数组引用，避免内联数组导致 effect 重跑 */
export function useStableArray<T>(list: readonly T[]): readonly T[] {
  const ref = useRef(list)
  const prev = ref.current
  if (prev !== list && (prev.length !== list.length || prev.some((item, i) => item !== list[i]))) {
    ref.current = list
  }
  return ref.current
}

/**
 * 依次调用扩展的 setup，卸载或扩展数组变化时调用其清理函数。
 * 任一扩展抛错只上报，不影响其他扩展与编辑器。
 */
export function useExtensionSetup(
  extensions: readonly EditorExtension[],
  ctx: ExtensionContext,
  onError: (extension: string, error: unknown) => void,
): void {
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  useEffect(() => {
    const cleanups: Array<[string, () => void]> = []
    for (const ext of extensions) {
      if (!ext.setup) continue
      try {
        const cleanup = ext.setup(ctx)
        if (typeof cleanup === 'function') cleanups.push([ext.name, cleanup])
      } catch (error) {
        onErrorRef.current(ext.name, error)
      }
    }
    return () => {
      for (const [name, cleanup] of cleanups.reverse()) {
        try {
          cleanup()
        } catch (error) {
          onErrorRef.current(name, error)
        }
      }
    }
  }, [extensions, ctx])
}
