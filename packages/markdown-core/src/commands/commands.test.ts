import { describe, expect, it, vi } from 'vitest'
import { createRenderer } from '../renderer/renderer'
import type { EditorEngine, Selection, TextState } from '../types'
import { MERMAID_TEMPLATES } from './block'
import { type CommandTransform, commands, execCommand, minimalDiff, runCommand } from './registry'

/** `«` and `»` mark the selection; `«»` is a caret. */
function st(marked: string): TextState {
  const start = marked.indexOf('«')
  const end = marked.indexOf('»') - 1
  return { text: marked.replace('«', '').replace('»', ''), selection: { start, end } }
}

function show({ text, selection: { start, end } }: TextState): string {
  return `${text.slice(0, start)}«${text.slice(start, end)}»${text.slice(end)}`
}

type Case = [name: string, transform: CommandTransform<never>, input: string, expected: string, args?: unknown]

const cases: Case[] = [
  ['bold wraps', commands.bold, 'a «b» c', 'a **«b»** c'],
  ['bold inserts placeholder', commands.bold, 'a «» c', 'a **«加粗文本»** c'],
  ['bold unwraps outside markers', commands.bold, 'a **«b»** c', 'a «b» c'],
  ['bold unwraps inside markers', commands.bold, 'a «**b**» c', 'a «b» c'],
  ['bold custom placeholder', commands.bold, '«»', '**«strong»**', { placeholder: 'strong' }],
  ['italic wraps', commands.italic, 'a «b» c', 'a *«b»* c'],
  ['italic inside bold wraps', commands.italic, '**«b»**', '***«b»***'],
  ['italic unwraps', commands.italic, '*«b»*', '«b»'],
  ['strikethrough wraps', commands.strikethrough, 'x«y»', 'x~~«y»~~'],
  ['strikethrough unwraps', commands.strikethrough, '~~«y»~~', '«y»'],
  ['inlineCode wraps', commands.inlineCode, '«k»', '`«k»`'],
  ['inlineCode placeholder', commands.inlineCode, '«»', '`«行内代码»`'],
  ['link selects url', commands.link, 'see «docs»', 'see [docs](«https://»)'],
  ['link with url selects text', commands.link, 'see «docs»', 'see [«docs»](https://e.com)', { url: 'https://e.com' }],
  ['link placeholder', commands.link, '«»', '[链接描述](«https://»)'],
  ['image placeholder', commands.image, '«»', '![图片描述](«https://»)'],
  ['image with args', commands.image, '«»', '![«logo»](a.png)', { url: 'a.png', text: 'logo' }],
  ['heading2 adds prefix keeping caret', commands.heading2, 'ti«»tle', '## ti«»tle'],
  ['heading2 toggles off', commands.heading2, '## ti«»tle', 'ti«»tle'],
  ['heading1 replaces other level', commands.heading1, '### «t»', '«# t»'],
  ['heading via args', commands.heading, '«»t', '### «»t', { level: 3 }],
  ['heading6 on second line only', commands.heading6, 'a\nb«»', 'a\n###### b«»'],
  ['quote caret', commands.quote, 'a«»', '> a«»'],
  ['quote lines', commands.quote, '«a\nb»', '«> a\n> b»'],
  ['quote toggles off', commands.quote, '«> a\n> b»', '«a\nb»'],
  ['ul skips blank lines', commands.unorderedList, '«a\n\nb»', '«- a\n\n- b»'],
  ['ul converts ordered list', commands.unorderedList, '«1. a\n2. b»', '«- a\n- b»'],
  ['ul toggles off', commands.unorderedList, '«- a\n- b»', '«a\nb»'],
  ['ol numbers lines', commands.orderedList, '«a\nb\nc»', '«1. a\n2. b\n3. c»'],
  ['ol toggles off', commands.orderedList, '«1. a\n2. b\n3. c»', '«a\nb\nc»'],
  ['task adds checkboxes', commands.taskList, '«a\n- b»', '«- [ ] a\n- [ ] b»'],
  ['task toggles off', commands.taskList, '«- [ ] a\n- [x] b»', '«a\nb»'],
  ['codeBlock empty after text', commands.codeBlock, 'x«»', 'x\n\n```\n«»\n```\n'],
  ['codeBlock wraps selected lines', commands.codeBlock, '«const a\nb»', '```\n«const a\nb»\n```\n'],
  ['codeBlock with lang', commands.codeBlock, '«x»', '```js\n«x»\n```\n', { lang: 'js' }],
  [
    'table default 2x3',
    commands.table,
    '«»',
    '| «列1» | 列2 | 列3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n',
  ],
  ['table rows x cols', commands.table, 'p«»', 'p\n\n| «列1» | 列2 |\n| --- | --- |\n|  |  |\n', { rows: 1, cols: 2 }],
  ['hr between lines', commands.hr, 'a«»\nb', 'a\n\n---«»\n\nb'],
  ['math block placeholder', commands.math, '«»', '$$\n«E=mc^2»\n$$\n'],
  ['math inline', commands.math, 'a «x» b', 'a $«x»$ b', { inline: true }],
  ['mermaid default flowchart', commands.mermaid, '«»', `\`\`\`mermaid\n«${MERMAID_TEMPLATES.flowchart}»\n\`\`\`\n`],
  [
    'mermaid sequence',
    commands.mermaid,
    '«»',
    `\`\`\`mermaid\n«${MERMAID_TEMPLATES.sequence}»\n\`\`\`\n`,
    { type: 'sequence' },
  ],
  ['toc inserts CSDN @[TOC](title) and selects the title', commands.toc, 'x«»', 'x\n\n@[TOC](«这里写目录标题»)\n'],
  ['mark wraps', commands.mark, 'a «b» c', 'a ==«b»== c'],
  ['mark placeholder', commands.mark, '«»', '==«高亮文本»=='],
  ['mark unwraps', commands.mark, '==«b»==', '«b»'],
  ['superscript wraps', commands.superscript, 'x«2»', 'x^«2»^'],
  ['superscript placeholder', commands.superscript, '«»', '^«上标»^'],
  ['subscript wraps', commands.subscript, 'H«2»O', 'H~«2»~O'],
  ['subscript placeholder', commands.subscript, '«»', '~«下标»~'],
  ['superscript unwraps markers', commands.superscript, 'x^«2»^', 'x«2»'],
  ['subscript unwraps markers', commands.subscript, 'H~«2»~O', 'H«2»O'],
  ['subscript inside strikethrough uses <sub> around the run', commands.subscript, '~~«b»~~', '<sub>~~«b»~~</sub>'],
  ['subscript selection containing ~ uses <sub>', commands.subscript, '«~~b~~»', '<sub>«~~b~~»</sub>'],
  ['subscript with whitespace uses <sub>', commands.subscript, 'a «x y» b', 'a <sub>«x y»</sub> b'],
  ['superscript with whitespace uses <sup>', commands.superscript, '«x y»', '<sup>«x y»</sup>'],
  ['superscript selection containing ^ uses <sup>', commands.superscript, '«^b»', '<sup>«^b»</sup>'],
  ['strikethrough on subscript uses <s> around the run', commands.strikethrough, 'x~«b»~', 'x<s>~«b»~</s>'],
  ['strikethrough selection containing ~ uses <s>', commands.strikethrough, '«~b~»', '<s>«~b~»</s>'],
  ['subscript unwraps tags outside', commands.subscript, 'a <sub>«x y»</sub> b', 'a «x y» b'],
  ['subscript unwraps tags inside', commands.subscript, '«<sub>b</sub>»', '«b»'],
  ['subscript unwraps tags around the run', commands.subscript, '<sub>~~«b»~~</sub>', '~~«b»~~'],
  ['superscript unwraps tags outside', commands.superscript, '<sup>«2»</sup>', '«2»'],
  ['superscript unwraps tags inside', commands.superscript, 'x«<sup>2</sup>»', 'x«2»'],
  ['strikethrough unwraps tags outside', commands.strikethrough, '<s>«b»</s>', '«b»'],
  ['strikethrough unwraps tags inside', commands.strikethrough, '«<s>b</s>»', '«b»'],
  ['strikethrough unwraps tags around the run', commands.strikethrough, 'x<s>~«b»~</s>', 'x~«b»~'],
]

describe('command transforms', () => {
  it.each(cases)('%s', (_name, transform, input, expected, args) => {
    const run = transform as CommandTransform<unknown>
    expect(show(run(st(input), args))).toBe(expected)
  })

  it('registers every spec command', () => {
    expect(Object.keys(commands).sort()).toEqual(
      [
        'bold',
        'codeBlock',
        'heading',
        'heading1',
        'heading2',
        'heading3',
        'heading4',
        'heading5',
        'heading6',
        'hr',
        'image',
        'inlineCode',
        'italic',
        'link',
        'mark',
        'math',
        'mermaid',
        'orderedList',
        'quote',
        'strikethrough',
        'subscript',
        'superscript',
        'table',
        'taskList',
        'toc',
        'unorderedList',
      ].sort(),
    )
  })

  it.each([
    ['strikethrough on line-start subscript', commands.strikethrough, '~«b»~ rest\n\nnext para', '<s><sub>b</sub></s>'],
    ['subscript on line-start strikethrough', commands.subscript, '~~«b»~~ rest\n\nnext para', '<sub><s>b</s></sub>'],
    ['subscript with whitespace', commands.subscript, 'a «x y» b\n\nnext para', '<sub>x y</sub>'],
    ['superscript with whitespace', commands.superscript, 'a «x y» b\n\nnext para', '<sup>x y</sup>'],
  ] as const)('%s renders without a code fence', (_name, transform, input, expected) => {
    const { html } = createRenderer().render(transform(st(input)).text)
    expect(html).toContain(expected)
    expect(html).toContain('<p>next para</p>')
    expect(html).not.toContain('<pre')
  })

  it('offers flowchart, sequence, gantt and class mermaid templates', () => {
    expect(Object.keys(MERMAID_TEMPLATES)).toEqual(['flowchart', 'sequence', 'gantt', 'class'])
  })
})

describe('minimalDiff', () => {
  it('returns null for identical text', () => {
    expect(minimalDiff('abc', 'abc')).toBeNull()
  })

  it('returns the smallest replaced range', () => {
    expect(minimalDiff('a\nb\nc', 'a\n# b\nc')).toEqual({ start: 2, end: 2, text: '# ' })
    expect(minimalDiff('hello', 'help')).toEqual({ start: 3, end: 5, text: 'p' })
  })

  it('never splits a surrogate pair', () => {
    expect(minimalDiff('a😀', 'a😃')).toEqual({ start: 1, end: 3, text: '😃' })
  })
})

function fakeEngine(initial: string, selection: Selection) {
  const calls: string[] = []
  let value = initial
  let sel = selection
  const engine: EditorEngine = {
    mount: vi.fn(),
    destroy: vi.fn(),
    getValue: () => value,
    setValue: (md) => {
      value = md
    },
    getSelection: () => sel,
    setSelection: (start, end) => {
      sel = { start, end }
      calls.push(`select ${start} ${end}`)
    },
    replace: (start, end, text) => {
      value = value.slice(0, start) + text + value.slice(end)
      calls.push(`replace ${start} ${end} ${JSON.stringify(text)}`)
    },
    undo: () => {
      calls.push('undo')
    },
    redo: () => {
      calls.push('redo')
    },
    focus: () => {
      calls.push('focus')
    },
    setReadOnly: vi.fn(),
    setPlaceholder: vi.fn(),
    on: () => () => {},
    getSectionOffsets: () => [],
    getCursorPosition: () => {
      const before = value.slice(0, sel.end)
      return { line: before.split('\n').length, column: before.length - before.lastIndexOf('\n') - 1 }
    },
  }
  return { engine, calls, value: () => value }
}

describe('runCommand / execCommand', () => {
  it('applies the minimal replace then selection then focus', () => {
    const fake = fakeEngine('a\nb\nc', { start: 2, end: 2 })
    runCommand(fake.engine, commands.heading1)
    expect(fake.calls).toEqual(['replace 2 2 "# "', 'select 4 4', 'focus'])
    expect(fake.value()).toBe('a\n# b\nc')
  })

  it('passes args to the transform', () => {
    const fake = fakeEngine('', { start: 0, end: 0 })
    runCommand(fake.engine, commands.link, { url: 'https://e.com', text: 'E' })
    expect(fake.value()).toBe('[E](https://e.com)')
    expect(fake.calls.at(-2)).toBe('select 1 2')
  })

  it('skips replace when the text is unchanged', () => {
    const fake = fakeEngine('abc', { start: 0, end: 0 })
    runCommand(fake.engine, (state: TextState) => ({ ...state, selection: { start: 1, end: 2 } }))
    expect(fake.calls).toEqual(['select 1 2', 'focus'])
  })

  it('execCommand routes undo/redo to the engine and others through runCommand', () => {
    const fake = fakeEngine('x', { start: 0, end: 1 })
    execCommand(fake.engine, 'undo')
    execCommand(fake.engine, 'redo')
    execCommand(fake.engine, 'bold')
    expect(fake.calls).toEqual(['undo', 'redo', 'replace 0 1 "**x**"', 'select 2 3', 'focus'])
  })

  it('normalizes a backward selection before transforming', () => {
    const fake = fakeEngine('a x b', { start: 3, end: 2 })
    const seen: Selection[] = []
    runCommand(fake.engine, (state: TextState) => {
      seen.push(state.selection)
      return commands.bold(state)
    })
    expect(seen).toEqual([{ start: 2, end: 3 }])
    expect(fake.value()).toBe('a **x** b')
  })

  it('reads the engine value only once', () => {
    const fake = fakeEngine('x', { start: 0, end: 1 })
    const getValue = vi.spyOn(fake.engine, 'getValue')
    runCommand(fake.engine, commands.bold)
    expect(getValue).toHaveBeenCalledTimes(1)
    expect(fake.value()).toBe('**x**')
  })
})

describe('table command bounds', () => {
  it.each([
    [{ rows: Number.NaN, cols: Number.NaN }],
    [{ rows: Number.POSITIVE_INFINITY, cols: Number.NEGATIVE_INFINITY }],
  ])('falls back to default rows/cols for non-finite args: %o', (args) => {
    expect(() => commands.table(st('«»'), args)).not.toThrow()
    expect(commands.table(st('«»'), args)).toEqual(commands.table(st('«»')))
  })
})
