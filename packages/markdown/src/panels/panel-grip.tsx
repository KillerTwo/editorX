import { useMessages } from '@geekx/toolbar'
import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'

/** 宽度范围为推断（参考图只有默认 390） */
export const PANEL_MIN_WIDTH = 300
export const PANEL_MAX_WIDTH = 600
export const PANEL_DEFAULT_WIDTH = 390
export const PANEL_WIDTH_VAR = '--ex-mde-panel-width'
const STEP = 10

export function clampPanelWidth(value: number): number {
  if (!Number.isFinite(value)) return PANEL_DEFAULT_WIDTH
  return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(value)))
}

/**
 * 右侧面板左缘的宽度拖柄。面板在右侧，向左拖为加宽。拖动中只改 rootRef 上的 CSS 变量与 aria-valuenow
 * （不触发重渲染），松开时 onChange 提交一次；键盘调整立即提交。
 */
export function PanelGrip({
  width,
  onChange,
  rootRef,
  controls,
}: {
  width: number
  onChange(width: number): void
  /** 写入 --ex-mde-panel-width 的元素（.ex-mde 根） */
  rootRef: RefObject<HTMLDivElement | null>
  /** 右侧面板 aside 的 id */
  controls: string
}) {
  const m = useMessages()
  const abortRef = useRef<(() => void) | null>(null)

  useEffect(() => () => abortRef.current?.(), [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (abortRef.current) return
    const next =
      e.key === 'ArrowLeft'
        ? width + STEP
        : e.key === 'ArrowRight'
          ? width - STEP
          : e.key === 'Home'
            ? PANEL_MIN_WIDTH
            : e.key === 'End'
              ? PANEL_MAX_WIDTH
              : null
    if (next === null) return
    e.preventDefault()
    onChange(clampPanelWidth(next))
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current
    if (e.button !== 0 || !root || abortRef.current) return
    e.preventDefault()
    const handle = e.currentTarget
    const pointerId = e.pointerId
    handle.setPointerCapture?.(pointerId)
    const startX = e.clientX
    const start = width
    let current = width
    const apply = (next: number) => {
      current = next
      root.style.setProperty(PANEL_WIDTH_VAR, `${next}px`)
      handle.setAttribute('aria-valuenow', String(next))
    }
    const move = (ev: globalThis.PointerEvent) => {
      const next = clampPanelWidth(start + startX - ev.clientX)
      if (next !== current) apply(next)
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
      aria-label={m.panels.resize}
      aria-valuemin={PANEL_MIN_WIDTH}
      aria-valuemax={PANEL_MAX_WIDTH}
      aria-valuenow={width}
      aria-controls={controls}
      className="ex-mde-panel-grip"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    />
  )
}
