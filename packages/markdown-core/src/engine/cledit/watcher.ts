// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditWatcher.js
export class Watcher {
  private observer: MutationObserver | undefined
  private watching = false

  constructor(
    private readonly el: Node,
    private readonly listener: MutationCallback,
    /** Receives records that were queued but not yet delivered when the observer was stopped. */
    private readonly onDropped?: (records: MutationRecord[]) => void,
  ) {}

  get isWatching(): boolean {
    return this.watching
  }

  start(): void {
    this.stop()
    this.observer = new MutationObserver(this.listener)
    this.observer.observe(this.el, { childList: true, subtree: true, characterData: true })
    this.watching = true
  }

  stop(): void {
    const pending = this.observer?.takeRecords() ?? []
    this.observer?.disconnect()
    this.observer = undefined
    this.watching = false
    if (pending.length > 0) this.onDropped?.(pending)
  }

  /** Removes and returns records that are queued but not yet delivered to the listener. */
  takeRecords(): MutationRecord[] {
    return this.observer?.takeRecords() ?? []
  }

  noWatch(cb: () => void): void {
    if (!this.watching) {
      cb()
      return
    }
    this.stop()
    try {
      cb()
    } finally {
      this.start()
    }
  }
}
