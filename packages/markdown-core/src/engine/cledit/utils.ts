// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditUtils.js
export interface TextChange {
  start: number
  removed: string
  inserted: string
}

export function diffRange(oldText: string, newText: string): TextChange | null {
  if (oldText === newText) return null
  const maxPrefix = Math.min(oldText.length, newText.length)
  let prefix = 0
  while (prefix < maxPrefix && oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)) prefix++
  const maxSuffix = Math.min(oldText.length, newText.length) - prefix
  let suffix = 0
  while (
    suffix < maxSuffix &&
    oldText.charCodeAt(oldText.length - 1 - suffix) === newText.charCodeAt(newText.length - 1 - suffix)
  ) {
    suffix++
  }
  return {
    start: prefix,
    removed: oldText.slice(prefix, oldText.length - suffix),
    inserted: newText.slice(prefix, newText.length - suffix),
  }
}

export function applyChange(text: string, change: TextChange): string {
  return text.slice(0, change.start) + change.inserted + text.slice(change.start + change.removed.length)
}

export function revertChange(text: string, change: TextChange): string {
  return text.slice(0, change.start) + change.removed + text.slice(change.start + change.inserted.length)
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait: number,
): ((...args: A) => void) & { cancel(): void; flush(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: A | undefined
  const run = () => {
    timer = undefined
    const args = pending
    pending = undefined
    if (args) fn(...args)
  }
  const debounced = (...args: A) => {
    pending = args
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(run, wait)
  }
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pending = undefined
  }
  debounced.flush = () => {
    if (timer !== undefined) clearTimeout(timer)
    run()
  }
  return debounced
}
