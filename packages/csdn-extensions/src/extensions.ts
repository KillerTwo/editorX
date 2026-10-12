import type { EditorExtension } from '@editorx/toolbar'
import { csdnTemplateExtension } from './template'
import { csdnVideoExtension } from './video'
import { csdnVoteExtension } from './vote'

export const csdnExtensions: readonly EditorExtension[] = [csdnVoteExtension, csdnTemplateExtension, csdnVideoExtension]

export { csdnTemplateExtension, csdnVideoExtension, csdnVoteExtension }
