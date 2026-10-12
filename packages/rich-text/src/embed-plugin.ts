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
        payload: viewElement.getAttribute('data-payload') ?? '',
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
