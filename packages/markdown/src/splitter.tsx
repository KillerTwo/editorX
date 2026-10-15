import { useMessages } from '@geekx/toolbar'
import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'

export const SPLIT_MIN = 0.2
export const SPLIT_MAX = 0.8
const STEP = 0.02
const PAGE_STEP = 0.1
export const SPLIT_VAR = '--ex-mde-split'

export function clampSplit(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, Math.round(value * 1000) / 1000))
}

export function splitFromPointer(clientX: number, rect: { left: number; width: number }): number | null {
  return rect.width > 0 ? clampSplit((clientX - rect.left) / rect.width) : null
}

const percent = (value: number) => String(Math.round(value * 100))

/**
 * 比对模式的分隔条。拖动中只改 bodyRef 上的 --ex-mde-split 与自身 aria-valuenow（不触发重渲染），
 * 松开时 onChange 提交一次；键盘调整立即提交。
 */
export function Splitter({
  value,
  onChange,
  bodyRef,
  controls,
}: {
  value: number
  onChange(next: number): void
  bodyRef: RefObject<HTMLDivElement | null>
  /** 被调整宽度的编辑区元素 id */
  controls?: string
}) {
  const m = useMessages()
  /** 拖动中为中止函数：恢复拖动前的比例并移除监听 */
  const abortRef = useRef<(() => void) | null>(null)

  useEffect(() => () => abortRef.current?.(), [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (abortRef.current) return
    const next =
      e.key === 'ArrowLeft' || e.key === 'ArrowDown'
        ? value - STEP
        : e.key === 'ArrowRight' || e.key === 'ArrowUp'
          ? value + STEP
          : e.key === 'PageDown'
            ? value - PAGE_STEP
            : e.key === 'PageUp'
              ? value + PAGE_STEP
              : e.key === 'Home'
                ? SPLIT_MIN
                : e.key === 'End'
                  ? SPLIT_MAX
                  : null
    if (next === null) return
    e.preventDefault()
    onChange(clampSplit(next))
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const body = bodyRef.current
    if (e.button !== 0 || !body || abortRef.current) return
    e.preventDefault()
    const handle = e.currentTarget
    const pointerId = e.pointerId
    handle.setPointerCapture?.(pointerId)
    const rect = body.getBoundingClientRect()
    const start = value
    let current = value
    // 按位移换算：分隔条与按比例算出的位置有固定偏差（样式中的 -13px），也不因按下位置偏离分隔条而跳动
    const grabOffset = e.clientX - (rect.left + start * rect.width)
    const apply = (next: number) => {
      current = next
      body.style.setProperty(SPLIT_VAR, String(next))
      handle.setAttribute('aria-valuenow', percent(next))
    }
    const move = (ev: globalThis.PointerEvent) => {
      const next = splitFromPointer(ev.clientX - grabOffset, rect)
      if (next !== null && next !== current) apply(next)
    }
    const doc = handle.ownerDocument
    // 捕获阶段先于编辑器的 Esc（退出全屏）：拖动中 Esc 只取消拖动
    const onDocKeyDown = (ev: globalThis.KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      ev.preventDefault()
      ev.stopPropagation()
      cancel()
    }
    const detach = () => {
      abortRef.current = null
      doc.removeEventListener('keydown', onDocKeyDown, true)
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', commit)
      handle.removeEventListener('pointercancel', cancel)
      handle.removeEventListener('lostpointercapture', commit)
      if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId)
    }
    function commit() {
      detach()
      if (current !== start) onChange(current)
    }
    function cancel() {
      detach()
      apply(start)
    }
    abortRef.current = cancel
    doc.addEventListener('keydown', onDocKeyDown, true)
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', commit)
    handle.addEventListener('pointercancel', cancel)
    handle.addEventListener('lostpointercapture', commit)
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={m.editor.splitter}
      aria-valuemin={SPLIT_MIN * 100}
      aria-valuemax={SPLIT_MAX * 100}
      aria-valuenow={Math.round(value * 100)}
      aria-controls={controls}
      className="ex-mde-splitter"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    />
  )
}
