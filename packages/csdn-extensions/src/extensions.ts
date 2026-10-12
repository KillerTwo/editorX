import type { EditorExtension } from '@editorx/toolbar'
import { csdnTemplateExtension } from './template'

export const csdnExtensions: readonly EditorExtension[] = [csdnTemplateExtension]

export { csdnTemplateExtension }
