'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface CompareViewProps {
  references: string[]
  selected?: string
  missingRef?: string
  target: string
}

export function CompareView({ references, selected, missingRef, target }: CompareViewProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'overlay' | 'side'>('overlay')
  const [opacity, setOpacity] = useState(50)
  // iframe 取参考图原始尺寸，叠加时逐像素对齐；舞台可滚动，控制栏不挤占
  const [refSize, setRefSize] = useState<{ ref: string; width: number; height: number } | null>(null)
  const size = refSize && refSize.ref === selected ? refSize : null
  const measure = (img: HTMLImageElement | null) => {
    if (!img || !selected || !img.complete || img.naturalWidth === 0) return
    if (size?.width === img.naturalWidth && size.height === img.naturalHeight) return
    setRefSize({ ref: selected, width: img.naturalWidth, height: img.naturalHeight })
  }

  const navigate = (next: { ref?: string; target?: string }) => {
    const params = new URLSearchParams()
    const ref = next.ref ?? selected
    if (ref) params.set('ref', ref)
    params.set('target', next.target ?? target)
    router.replace(`/compare?${params.toString()}`)
  }

  return (
    <div className="pg-compare">
      <div className="pg-compare__bar">
        <label>
          参考图{' '}
          <select value={selected ?? ''} onChange={(e) => navigate({ ref: e.target.value })} disabled={!references.length}>
            {references.map((file) => (
              <option key={file} value={file}>{file}</option>
            ))}
          </select>
        </label>
        <label>
          目标路径{' '}
          <input
            key={target}
            defaultValue={target}
            onBlur={(e) => {
              if (e.target.value !== target) navigate({ target: e.target.value })
            }}
          />
        </label>
        <span role="radiogroup" aria-label="对比模式">
          <label><input type="radio" name="mode" checked={mode === 'overlay'} onChange={() => setMode('overlay')} />叠加</label>
          <label><input type="radio" name="mode" checked={mode === 'side'} onChange={() => setMode('side')} />并排</label>
        </span>
        <label>
          参考图透明度{' '}
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            aria-label="参考图透明度"
            onChange={(e) => setOpacity(Number(e.target.value))}
          />
        </label>
      </div>
      <div className={`pg-compare__stage pg-compare__stage--${mode}`}>
        <iframe
          title="目标页面"
          src={target}
          style={size ? { flex: 'none', width: size.width, height: size.height } : undefined}
        />
        {selected ? (
          <img
            key={selected}
            ref={measure}
            src={`/reference/${selected}`}
            alt="CSDN 参考截图"
            style={{ opacity: mode === 'overlay' ? opacity / 100 : 1 }}
            onLoad={(e) => measure(e.currentTarget)}
          />
        ) : (
          <p className="pg-compare__empty">
            {missingRef ? (
              <>
                未找到参考截图 <code>{missingRef}</code>。
              </>
            ) : (
              '暂无参考截图。'
            )}
            请将登录 CSDN 后截取的图片放入 <code>apps/playground/public/reference/</code>
          </p>
        )}
      </div>
    </div>
  )
}
