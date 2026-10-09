import type { ExtensionContext } from './extension'
import type { ResolvedItem } from './layout'

function evaluate(fn: () => boolean, extension: string): boolean {
  try {
    return fn()
  } catch (error) {
    console.error(`[editorx] 扩展 ${extension} 的状态计算出错`, error)
    return false
  }
}

export function isItemActive(resolved: ResolvedItem, ctx: ExtensionContext): boolean {
  const { active } = resolved.item
  if (active === undefined) return false
  if (typeof active === 'string') return ctx.formats.has(active)
  return evaluate(() => active(ctx), resolved.extension)
}

export function isItemDisabled(resolved: ResolvedItem, ctx: ExtensionContext, readOnly: boolean): boolean {
  if (resolved.disabledByAdapter) return true
  if (readOnly && !resolved.item.allowReadOnly) return true
  const { disabled } = resolved.item
  return disabled ? evaluate(() => disabled(ctx), resolved.extension) : false
}
