export interface PreviewPatchResult {
  /** Newly created section elements, in document order (reused sections are not included). */
  changed: HTMLElement[]
}

function buildSection(doc: Document, html: string, index: number): HTMLElement {
  const el = doc.createElement('div')
  el.className = 'ex-preview-section'
  el.dataset.sectionIndex = String(index)
  el.innerHTML = html
  return el
}

/**
 * Updates a preview container in place so it holds one `<div class="ex-preview-section" data-section-index="i">` per
 * section, as direct children, in order.
 *
 * `previous` is caller-owned state: the section HTML the container currently shows (start with `[]`; it is updated
 * in place). The unchanged prefix and suffix are matched by HTML and their elements reused, so content added after
 * rendering (diagram SVGs, loaded images) survives inserts and deletes; only the middle range is rebuilt and reused
 * elements get their `data-section-index` rewritten where it shifted. If `previous` does not describe the container
 * (e.g. it was emptied to force a rebuild, or children were added by someone else), every section is rebuilt.
 */
export function patchPreview(
  container: HTMLElement,
  sections: readonly { html: string }[],
  previous: string[],
): PreviewPatchResult {
  const doc = container.ownerDocument
  const next = sections.map((s) => s.html)
  let old = Array.from(container.children) as HTMLElement[]
  if (old.length !== previous.length) {
    container.replaceChildren()
    old = []
    previous.length = 0
  }

  let left = 0
  while (left < old.length && left < next.length && previous[left] === next[left]) left++
  let right = 0
  while (
    right < old.length - left &&
    right < next.length - left &&
    previous[old.length - 1 - right] === next[next.length - 1 - right]
  ) {
    right++
  }

  for (let i = left; i < old.length - right; i++) old[i]!.remove()
  const changed: HTMLElement[] = []
  const fragment = doc.createDocumentFragment()
  for (let i = left; i < next.length - right; i++) {
    const el = buildSection(doc, next[i]!, i)
    fragment.appendChild(el)
    changed.push(el)
  }
  container.insertBefore(fragment, right > 0 ? old[old.length - right]! : null)

  for (let k = 0; k < right; k++) {
    const el = old[old.length - right + k]!
    const index = String(next.length - right + k)
    if (el.dataset.sectionIndex !== index) el.dataset.sectionIndex = index
  }
  previous.splice(0, previous.length, ...next)
  return { changed }
}
