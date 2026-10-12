import type { EmbedDef } from '@editorx/toolbar'
import { toWidget, trustedHtml, type Editor } from 'ckeditor5'

type ModelElement = {
  getAttribute(name: string): unknown
}

type ViewNode = Parameters<typeof toWidget>[0]

type ViewWriter = {
  createContainerElement(name: string, attributes: Record<string, string>): ViewNode
  createRawElement(
    name: string,
    attributes: Record<string, string>,
    render: (domElement: HTMLElement) => void,
  ): ViewNode
  setAttribute(key: string, value: string, element: ViewNode): void
  insert(position: unknown, node: ViewNode): void
  createPositionAt(item: ViewNode, offset: number): unknown
}

type RenderHtml = EmbedDef['renderHtml']

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

function cardHtml(renderers: ReadonlyMap<string, RenderHtml>, element: ModelElement): string {
  const render = renderers.get(String(element.getAttribute('embedType') ?? ''))
  if (!render) return ''
  const raw = String(element.getAttribute('payload') ?? '')
  let payload: unknown = null
  if (raw !== '') {
    try {
      payload = JSON.parse(raw) as unknown
    } catch {
      return ''
    }
  }
  try {
    return render(payload)
  } catch {
    return ''
  }
}

function insertCard(viewWriter: ViewWriter, element: ViewNode, html: string): void {
  if (!html) return
  const raw = viewWriter.createRawElement('div', {}, (domElement) => {
    domElement.innerHTML = trustedHtml(html)
  })
  viewWriter.insert(viewWriter.createPositionAt(element, 0), raw)
}

/** 嵌入块模型 `exEmbed`，数据 HTML 为 `<div data-ex-embed data-payload>`，编辑态与发布 HTML 放入匹配扩展的 `renderHtml`。 */
export function registerExEmbed(editor: Editor, embeds: readonly EmbedDef[] = []): void {
  const renderers = new Map(embeds.map((embed) => [embed.type, embed.renderHtml]))
  editor.data.registerRawContentMatcher({
    name: 'div',
    attributes: { 'data-ex-embed': true },
  })
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
    view: (modelElement, { writer }) => {
      const viewWriter = writer as ViewWriter
      const element = viewWriter.createContainerElement('div', embedAttributes(modelElement))
      insertCard(viewWriter, element, cardHtml(renderers, modelElement))
      return element
    },
  })

  editor.conversion.for('editingDowncast').elementToElement({
    model: 'exEmbed',
    view: (modelElement, { writer }) => {
      const viewWriter = writer as ViewWriter
      const element = viewWriter.createContainerElement('div', {
        ...embedAttributes(modelElement),
        contenteditable: 'false',
      })
      insertCard(viewWriter, element, cardHtml(renderers, modelElement))
      viewWriter.setAttribute('contenteditable', 'false', element)
      return toWidget(element, writer)
    },
  })
}
