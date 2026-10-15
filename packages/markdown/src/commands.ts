import { commands, execCommand, type CommandName, type EditorEngine } from '@geekx/markdown-core'
import type { CommandRegistry } from '@geekx/toolbar'

const NAMES: readonly string[] = [...Object.keys(commands), 'undo', 'redo']

export function createCommandRegistry(engine: EditorEngine): CommandRegistry {
  return {
    has: (name) => NAMES.includes(name),
    run(name, args) {
      if (!NAMES.includes(name)) return false
      execCommand(engine, name as CommandName, args)
      return true
    },
    list: () => [...NAMES],
  }
}
