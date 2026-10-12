import type { EditorExtension } from '@editorx/toolbar'
import { csdnInscodeExtension } from './inscode'
import { csdnResourceExtension } from './resource'
import { csdnTemplateExtension } from './template'
import { csdnVideoExtension } from './video'
import { csdnVoteExtension } from './vote'

export const csdnExtensions: readonly EditorExtension[] = [
  csdnVoteExtension,
  csdnTemplateExtension,
  csdnVideoExtension,
  csdnResourceExtension,
  csdnInscodeExtension,
]

export { csdnInscodeExtension, csdnResourceExtension, csdnTemplateExtension, csdnVideoExtension, csdnVoteExtension }
