import type { EditorExtension } from '@editorx/toolbar'
import { csdnTemplateExtension } from './template'
import { csdnVoteExtension } from './vote'

export const csdnExtensions: readonly EditorExtension[] = [csdnVoteExtension, csdnTemplateExtension]

export { csdnTemplateExtension, csdnVoteExtension }
