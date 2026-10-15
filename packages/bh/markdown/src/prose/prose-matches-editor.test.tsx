import type { DocNode } from '@bh/richtext';
import { RichTextEditor } from '@bh/richtext/editor';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { Prose } from './prose';

// Prose and the editor wear one look, `.rt`, which draws element by element
// and by the data attributes the editor's nodes carry. So the same document,
// drawn by each, must come out as the same markup under `.rt`: then a text
// reads as it edits, and doesn't jump between the two. This draws both and
// compares them, leaving out what is only the editor's machinery.

beforeAll(() => {
  // ProseMirror measures where the caret is, which jsdom can't.
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  document.elementFromPoint = () => null;
});

const text = (value: string, marks?: DocNode['marks']): DocNode => {
  return { type: 'text', text: value, ...(marks ? { marks } : {}) };
};
const paragraph = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });
const item = (...content: DocNode[]): DocNode => ({ type: 'listItem', content });

/** A document holding every node and mark bh's editor writes. */
const DOCUMENT: DocNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [text('One')] },
    { type: 'heading', attrs: { level: 2 }, content: [text('Two')] },
    { type: 'heading', attrs: { level: 3, textAlign: 'center' }, content: [text('Three')] },
    paragraph(
      text('Plain, '),
      text('bold ', [{ type: 'bold' }]),
      text('and italic', [{ type: 'bold' }, { type: 'italic' }]),
      text(', '),
      text('under', [{ type: 'underline' }]),
      text(' '),
      text('struck', [{ type: 'strike' }]),
      text(' '),
      text('code', [{ type: 'code' }]),
      text(' '),
      text('a link', [{ type: 'link', attrs: { href: 'https://example.com' } }]),
      text(' '),
      text('lit', [{ type: 'highlight', attrs: { color: 'var(--color-yellow-4)' } }]),
      text(' '),
      text('red', [{ type: 'textStyle', attrs: { color: 'var(--color-red-9)' } }]),
      { type: 'hardBreak' },
      text('after a break, '),
      { type: 'mention', attrs: { id: '7', label: 'Mara K.' } },
      text('.'),
    ),
    {
      type: 'bulletList',
      content: [item(paragraph(text('first'))), item(paragraph(text('second')))],
    },
    {
      type: 'orderedList',
      attrs: { start: 3 },
      content: [
        item(paragraph(text('third')), {
          type: 'bulletList',
          content: [item(paragraph(text('inner')))],
        }),
      ],
    },
    {
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('done'))] },
        { type: 'taskItem', attrs: { checked: false }, content: [paragraph(text('open'))] },
      ],
    },
    { type: 'blockquote', content: [paragraph(text('quoted'))] },
    { type: 'codeBlock', attrs: { language: 'ts' }, content: [text('const a = 1;\nconst b = 2;')] },
    { type: 'horizontalRule' },
    { type: 'callout', attrs: { kind: 'warning' }, content: [paragraph(text('Careful.'))] },
    { type: 'image', attrs: { src: 'https://example.com/plan.png', alt: 'The plan' } },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [paragraph(text('Step'))] },
            { type: 'tableHeader', content: [paragraph(text('Done'))] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [paragraph(text('one'))] },
            { type: 'tableCell', content: [paragraph(text('yes', [{ type: 'code' }]))] },
          ],
        },
      ],
    },
  ],
};

/** The attributes `.rt` draws by, and those that say what a node is. */
const KEPT = [
  'data-callout',
  'data-mention',
  'data-mention-avatar',
  'data-type',
  'data-checked',
  'data-color',
  'start',
  'href',
  'src',
  'alt',
  'type',
];

interface Shape {
  tag: string;
  attrs: Record<string, string>;
  children: (Shape | string)[];
}

/** An element as `.rt` sees it: its tag, the attributes it draws by, its children. */
function shapeOf(element: Element): Shape {
  const attrs: Record<string, string> = {};
  for (const name of KEPT) {
    const value = element.getAttribute(name);
    if (value !== null) {
      attrs[name] = value;
    }
  }
  const language = [...element.classList].find((name) => name.startsWith('language-'));
  if (language) {
    attrs['class'] = language;
  }
  const { textAlign, color, backgroundColor } = (element as HTMLElement).style;
  for (const [name, value] of Object.entries({ textAlign, color, backgroundColor })) {
    if (value) {
      attrs[`style:${name}`] = value;
    }
  }
  if (element instanceof HTMLInputElement) {
    attrs['checked'] = String(element.checked);
  }
  for (const span of ['colspan', 'rowspan']) {
    const value = element.getAttribute(span);
    if (value !== null && value !== '1') {
      attrs[span] = value;
    }
  }
  return { tag: element.tagName.toLowerCase(), attrs, children: childrenOf(element) };
}

/**
 * What is only the editor's: its trailing breaks, its separators, a table's
 * column widths and wrapper, and the words it keeps, hidden, beside a task's
 * checkbox for a screen reader (Prose names the checkbox itself).
 */
function isMachinery(element: Element): boolean {
  return (
    element.classList.contains('ProseMirror-trailingBreak') ||
    element.classList.contains('ProseMirror-separator') ||
    element.tagName === 'COLGROUP' ||
    (element.tagName === 'SPAN' && element.parentElement?.tagName === 'LABEL')
  );
}

/** The editor keeps an empty paragraph after a last block that isn't one, to type into. */
function withoutTrailingParagraph(shapes: (Shape | string)[]): (Shape | string)[] {
  const last = shapes.at(-1);
  const empty = typeof last === 'object' && last.tag === 'p' && last.children.length === 0;
  return empty ? shapes.slice(0, -1) : shapes;
}

function childrenOf(element: Element): (Shape | string)[] {
  const out: (Shape | string)[] = [];
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const value = child.textContent ?? '';
      if (value !== '') {
        // Text split in two by the DOM reads as one run.
        const last = out.at(-1);
        if (typeof last === 'string') {
          out[out.length - 1] = last + value;
        } else {
          out.push(value);
        }
      }
      continue;
    }
    if (!(child instanceof Element) || isMachinery(child)) {
      continue;
    }
    if (child.classList.contains('tableWrapper')) {
      out.push(...childrenOf(child));
      continue;
    }
    out.push(shapeOf(child));
  }
  return out;
}

describe('Prose and the editor', () => {
  it('draw the same document as the same markup under .rt', () => {
    const editor = render(
      <RichTextEditor label="Body" value={JSON.stringify(DOCUMENT)} readOnly onChange={() => {}} />,
    );
    const editing = editor.container.querySelector('.rt .ProseMirror');
    expect(editing).not.toBeNull();
    const edited = withoutTrailingParagraph(childrenOf(editing as Element));
    editor.unmount();

    const prose = render(<Prose>{DOCUMENT}</Prose>);
    const reading = prose.container.querySelector('.rt');
    expect(reading).not.toBeNull();

    expect(childrenOf(reading as Element)).toEqual(edited);
    // And it holds every node and mark, so nothing above was left out of both.
    expect(JSON.stringify(edited)).toContain('"data-callout":"warning"');
    expect(JSON.stringify(edited)).toContain('"data-mention":"Mara K."');
  });

  it('share one sheet, the editor’s, which Prose’s own brings', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const sheet = readFileSync(resolve(here, '../../styles.css'), 'utf8');
    expect(sheet).toContain("@import '@bh/richtext/prose.css';");
  });
});
