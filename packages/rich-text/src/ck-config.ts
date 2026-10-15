import type { EditorAdapters, EmbedDef } from '@geekx/toolbar'
import type { Editor, ViewDowncastWriter, ViewElement } from 'ckeditor5'
import { registerExEmbed } from './embed-plugin'
import { createUploadAdapter } from './upload-adapter'

const CODE_LANGUAGES = ['plaintext', 'javascript', 'typescript', 'python', 'java', 'go', 'bash', 'json'] as const

type PluginBase = abstract new (...args: never[]) => { readonly editor: Editor }

type CkRuntime = {
  toWidget: (element: object, writer: object) => object
  trustedHtml: (html: string) => string
}

function createExBridgePlugin(
  Plugin: PluginBase,
  ck: CkRuntime,
  uploadImage?: EditorAdapters['uploadImage'],
  embeds: readonly EmbedDef[] = [],
) {
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
      registerExEmbed(this.editor, embeds, ck)
    }
  }
}

export async function createEditorConfig(options: {
  uploadImage?: EditorAdapters['uploadImage']
  embeds?: readonly EmbedDef[]
}): Promise<{
  licenseKey: 'GPL'
  toolbar: { items: [] }
  plugins: unknown[]
  extraPlugins: unknown[]
  codeBlock: { languages: { language: string; label: string }[] }
  htmlSupport: { allow: { name: string; attributes: { 'data-ex-math': true } }[] }
  image: { toolbar: string[] }
}> {
  const {
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
    toWidget,
    trustedHtml,
  } = await import('ckeditor5')

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
    extraPlugins: [
      createExBridgePlugin(
        Plugin,
        {
          toWidget: (element, writer) => toWidget(element as ViewElement, writer as ViewDowncastWriter),
          trustedHtml,
        },
        options.uploadImage,
        options.embeds,
      ),
    ],
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
