import type { EditorAdapters } from '@editorx/toolbar'
import {
  Alignment,
  BlockQuote,
  Bold,
  Code,
  CodeBlock,
  Essentials,
  Font,
  FontBackgroundColor,
  FontColor,
  GeneralHtmlSupport,
  Heading,
  HorizontalLine,
  Image,
  ImageCaption,
  ImageInsert,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Italic,
  Link,
  List,
  Paragraph,
  Plugin,
  RemoveFormat,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TableToolbar,
  TodoList,
  Underline,
  Undo,
} from 'ckeditor5'
import { registerExEmbed } from './embed-plugin'
import { createUploadAdapter } from './upload-adapter'

const CODE_LANGUAGES = ['plaintext', 'javascript', 'typescript', 'python', 'java', 'go', 'bash', 'json'] as const

function createExBridgePlugin(uploadImage?: EditorAdapters['uploadImage']) {
  return class ExBridgePlugin extends Plugin {
    static get pluginName() {
      return 'ExBridge' as const
    }

    static get requires() {
      return uploadImage ? (['FileRepository'] as const) : []
    }

    init(): void {
      if (uploadImage) {
        const repository = this.editor.plugins.get('FileRepository') as {
          createUploadAdapter?: (loader: { readonly file: Promise<File | null> }) => unknown
        }
        repository.createUploadAdapter = (loader) => createUploadAdapter(loader.file, uploadImage)
      }
      registerExEmbed(this.editor)
    }
  }
}

export function createEditorConfig(options: { uploadImage?: EditorAdapters['uploadImage'] }): {
  licenseKey: 'GPL'
  toolbar: { items: [] }
  plugins: unknown[]
  extraPlugins: unknown[]
  codeBlock: { languages: { language: string; label: string }[] }
  htmlSupport: { allow: { name: string; attributes: { 'data-ex-math': true } }[] }
  image: { toolbar: string[] }
} {
  return {
    licenseKey: 'GPL' as const,
    toolbar: { items: [] as [] },
    plugins: [
      Essentials,
      Paragraph,
      Heading,
      Bold,
      Italic,
      Underline,
      Strikethrough,
      Code,
      Subscript,
      Superscript,
      RemoveFormat,
      Font,
      FontColor,
      FontBackgroundColor,
      List,
      TodoList,
      Alignment,
      HorizontalLine,
      BlockQuote,
      CodeBlock,
      Link,
      Image,
      ImageUpload,
      ImageInsert,
      ImageCaption,
      ImageStyle,
      ImageToolbar,
      Table,
      TableToolbar,
      GeneralHtmlSupport,
      Undo,
    ],
    extraPlugins: [createExBridgePlugin(options.uploadImage)],
    codeBlock: {
      languages: CODE_LANGUAGES.map((language) => ({ language, label: language })),
    },
    htmlSupport: {
      allow: [{ name: 'p', attributes: { 'data-ex-math': true as const } }],
    },
    image: {
      toolbar: ['toggleImageCaption', 'imageTextAlternative'],
    },
  }
}
