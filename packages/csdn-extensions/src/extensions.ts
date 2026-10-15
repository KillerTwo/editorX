import type { EditorExtension } from '@geekx/toolbar'
import { csdnAiExtension } from './ai'
import { csdnInscodeExtension } from './inscode'
import { csdnResourceExtension } from './resource'
import { csdnTemplateExtension } from './template'
import { csdnVideoExtension } from './video'
import { csdnVoteExtension } from './vote'

export const csdnExtensions: readonly EditorExtension[] = [
  csdnAiExtension,
  csdnVoteExtension,
  csdnVideoExtension,
  csdnResourceExtension,
  csdnInscodeExtension,
  csdnTemplateExtension,
]

export {
  csdnAiExtension,
  csdnInscodeExtension,
  csdnResourceExtension,
  csdnTemplateExtension,
  csdnVideoExtension,
  csdnVoteExtension,
}
