const STATS_TIMEOUT = 300

export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (scheduler?.yield) return scheduler.yield()
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export interface IdleDeadlineLike {
  didTimeout: boolean
  timeRemaining(): number
}

export function whenIdle(cb: (deadline: IdleDeadlineLike) => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(cb, { timeout: STATS_TIMEOUT })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 0)
  return () => clearTimeout(id)
}
