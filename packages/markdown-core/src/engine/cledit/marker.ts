// Ported from StackEdit (https://github.com/benweet/stackedit), Apache-2.0. Original: src/services/editor/cledit/cleditMarker.js
import type { TextChange } from './utils'

export class Marker {
  offset: number
  readonly trailing: boolean

  constructor(offset: number, trailing = false) {
    this.offset = offset
    this.trailing = trailing
  }

  adjust(change: TextChange): void {
    const { start, removed, inserted } = change
    if (this.offset > start) this.offset -= Math.min(removed.length, this.offset - start)
    if (this.trailing ? this.offset > start : this.offset >= start) this.offset += inserted.length
  }
}
