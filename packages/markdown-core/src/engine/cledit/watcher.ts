// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditWatcher.js
export class Watcher {
  private observer: MutationObserver | undefined
  private watching = false

  constructor(
    private readonly el: Node,
    private readonly listener: MutationCallback,
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
    this.observer?.disconnect()
    this.observer = undefined
    this.watching = false
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
