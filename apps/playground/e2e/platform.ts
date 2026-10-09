const mac = process.platform === 'darwin'

/** 光标导航按键：macOS 用 ⌘+方向键（Home/End 在 macOS 上只滚动、不移动光标），其他平台用 Ctrl+Home/End、Home/End */
export const KEYS = {
  docStart: mac ? 'Meta+ArrowUp' : 'Control+Home',
  docEnd: mac ? 'Meta+ArrowDown' : 'Control+End',
  lineStart: mac ? 'Meta+ArrowLeft' : 'Home',
  lineEnd: mac ? 'Meta+ArrowRight' : 'End',
} as const

/** 依赖字体度量的几何容差：darwin 用 darwinTol（无微软雅黑），其他平台用 winTol */
export function fontTol(winTol: number, darwinTol: number): number {
  return mac ? darwinTol : winTol
}
