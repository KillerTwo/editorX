// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditUtils.js
export interface TextChange {
  start: number
  removed: string
  inserted: string
}

// Binary search over substring equality: native string comparison beats a per-character loop on long documents.
function commonPrefix(a: string, b: string, max: number): number {
  let lo = 0
  let hi = max
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (a.slice(lo, mid) === b.slice(lo, mid)) lo = mid
    else hi = mid - 1
  }
  return lo
}

function commonSuffix(a: string, b: string, max: number): number {
  let lo = 0
  let hi = max
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (a.slice(a.length - mid, a.length - lo) === b.slice(b.length - mid, b.length - lo)) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function diffRange(oldText: string, newText: string): TextChange | null {
  if (oldText === newText) return null
  const prefix = commonPrefix(oldText, newText, Math.min(oldText.length, newText.length))
  const suffix = commonSuffix(oldText, newText, Math.min(oldText.length, newText.length) - prefix)
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
