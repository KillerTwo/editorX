import { toWidget, type Editor } from 'ckeditor5'

type ModelElement = {
  getAttribute(name: string): unknown
}

type ViewWriter = {
  createContainerElement(name: string, attributes: Record<string, string>): Parameters<typeof toWidget>[0]
  setAttribute(key: string, value: string, element: Parameters<typeof toWidget>[0]): void
}

function embedAttributes(element: ModelElement): Record<string, string> {
  return {
    'data-ex-embed': String(element.getAttribute('embedType') ?? ''),
    'data-payload': String(element.getAttribute('payload') ?? ''),
  }
}

function decodePayload(value: string | undefined): string {
  if (!value) return ''
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return value
  }
}

function readPayload(viewElement: { getAttribute(name: string): string | undefined }): string {
  const raw = viewElement.getAttribute('data-payload')
  if (raw !== undefined) return raw
  return decodePayload(viewElement.getAttribute('data-ex-payload'))
}

/** 嵌入块模型 `exEmbed`，数据 HTML 为 `<div data-ex-embed data-payload>`。 */
export function registerExEmbed(editor: Editor): void {
  editor.model.schema.register('exEmbed', {
    inheritAllFrom: '$blockObject',
    allowAttributes: ['embedType', 'payload'],
  })

  editor.conversion.for('upcast').elementToElement({
    view: {
      name: 'div',
      attributes: { 'data-ex-embed': true },
    },
    model: (viewElement, { writer }) =>
      writer.createElement('exEmbed', {
        embedType: viewElement.getAttribute('data-ex-embed') ?? '',
        payload: readPayload(viewElement),
      }),
  })

  editor.conversion.for('dataDowncast').elementToElement({
    model: 'exEmbed',
    view: (modelElement, { writer }) => writer.createContainerElement('div', embedAttributes(modelElement)),
  })

  editor.conversion.for('editingDowncast').elementToElement({
    model: 'exEmbed',
    view: (modelElement, { writer }) => {
      const viewWriter = writer as ViewWriter
      const element = viewWriter.createContainerElement('div', {
        ...embedAttributes(modelElement),
        contenteditable: 'false',
      })
      viewWriter.setAttribute('contenteditable', 'false', element)
      return toWidget(element, writer)
    },
  })
}
