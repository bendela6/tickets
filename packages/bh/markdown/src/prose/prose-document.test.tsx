import type { DocNode } from '@bh/richtext';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { ProseNodeProps } from './document';
import { Prose } from './prose';

const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });
const text = (value: string, marks?: DocNode['marks']): DocNode => {
  return { type: 'text', text: value, ...(marks ? { marks } : {}) };
};
const paragraph = (...content: DocNode[]): DocNode => ({ type: 'paragraph', content });

/** The wrapper Prose draws: the editor's look, `.rt`. */
const root = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe('Prose, with a document', () => {
  it('draws a stored document as the editor draws it', () => {
    const stored = JSON.stringify(
      doc(
        { type: 'heading', attrs: { level: 2 }, content: [text('Plan')] },
        paragraph(text('Ship '), text('one', [{ type: 'bold' }]), text(' queue.')),
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [paragraph(text('first'))] }],
        },
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('done'))] },
            { type: 'taskItem', attrs: { checked: false }, content: [paragraph(text('open'))] },
          ],
        },
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [text('const a = 1;')] },
        { type: 'blockquote', content: [paragraph(text('quoted'))] },
        { type: 'horizontalRule' },
      ),
    );
    const { container } = render(<Prose>{stored}</Prose>);
    expect(root(container)).toHaveClass('rt');
    expect(screen.getByRole('heading', { level: 2, name: 'Plan' })).toBeInTheDocument();
    expect(container.querySelector('p strong')).toHaveTextContent('one');
    // A list item holds its paragraph, as in the editor, so `.rt` spaces both alike.
    expect(container.querySelector('ul > li > p')).toHaveTextContent('first');
    const tasks = container.querySelectorAll('ul[data-type="taskList"] > li');
    expect([...tasks].map((task) => task.getAttribute('data-checked'))).toEqual(['true', 'false']);
    expect(screen.getByRole('checkbox', { name: 'done' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'open' })).not.toBeChecked();
    expect(container.querySelector('pre > code.language-ts')).toHaveTextContent('const a = 1;');
    expect(container.querySelector('blockquote > p')).toHaveTextContent('quoted');
    expect(container.querySelector('hr')).not.toBeNull();
  });

  it('takes the document itself, as well as its JSON', () => {
    render(<Prose>{doc(paragraph(text('as an object')))}</Prose>);
    expect(screen.getByText('as an object').tagName).toBe('P');
  });

  it('keeps runs that share a mark in one element of it, outermost first', () => {
    const { container } = render(
      <Prose>
        {doc(
          paragraph(
            text('bold ', [{ type: 'bold' }]),
            text('and italic', [{ type: 'bold' }, { type: 'italic' }]),
            text(' link', [{ type: 'link', attrs: { href: 'https://example.com' } }]),
          ),
        )}
      </Prose>,
    );
    const strong = container.querySelectorAll('strong');
    expect(strong).toHaveLength(1);
    expect(strong[0]?.innerHTML).toBe('bold <em>and italic</em>');
    const link = screen.getByRole('link', { name: 'link' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
  });

  it('draws bh’s nodes: a callout by its kind, a mention’s chip, an image', () => {
    const { container } = render(
      <Prose>
        {doc(
          { type: 'callout', attrs: { kind: 'warning' }, content: [paragraph(text('Careful.'))] },
          paragraph(text('Ask '), { type: 'mention', attrs: { id: '7', label: 'Mara K.' } }),
          { type: 'image', attrs: { src: '/files/plan.png', alt: 'The plan' } },
        )}
      </Prose>,
    );
    expect(container.querySelector('[data-callout="warning"] > p')).toHaveTextContent('Careful.');
    const chip = container.querySelector('[data-mention="Mara K."]');
    expect(chip?.querySelector('[data-mention-avatar]')).toHaveTextContent('MK');
    expect(chip).toHaveTextContent('MKMara K.');
    expect(screen.getByRole('img', { name: 'The plan' })).toHaveAttribute('src', '/files/plan.png');
  });

  it('draws an app’s own node with its renderer, and lets it redraw one of bh’s', () => {
    const open = vi.fn();
    function TicketChip({ node }: ProseNodeProps) {
      const label = String(node.attrs?.['label'] ?? '');
      return (
        <button type="button" onClick={() => open(label)}>
          {label}
        </button>
      );
    }
    function Person({ node }: ProseNodeProps) {
      return <b>{String(node.attrs?.['label'] ?? '')}</b>;
    }
    const nodes = { ticketRef: TicketChip, mention: Person };
    const { container } = render(
      <Prose nodes={nodes}>
        {doc(
          paragraph(
            text('See '),
            { type: 'ticketRef', attrs: { id: null, label: 'TIX-42' } },
            text(' with '),
            { type: 'mention', attrs: { label: 'beka' } },
          ),
        )}
      </Prose>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'TIX-42' }));
    expect(open).toHaveBeenCalledWith('TIX-42');
    expect(container.querySelector('b')).toHaveTextContent('beka');
    expect(container.querySelector('[data-mention]')).toBeNull();
  });

  it('keeps the words of a node it has no renderer for', () => {
    const { container } = render(
      <Prose>
        {doc(paragraph(text('See '), { type: 'ticketRef', attrs: { label: 'TIX-9' } }), {
          type: 'someBox',
          content: [paragraph(text('inside'))],
        })}
      </Prose>,
    );
    expect(root(container)).toHaveTextContent('See TIX-9inside');
  });

  it('never runs what a document holds: no script links, no script images, no style beyond a colour', () => {
    const { container } = render(
      <Prose>
        {doc(
          paragraph(
            text('run', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
            text(' red', [{ type: 'textStyle', attrs: { color: 'var(--color-red-9)' } }]),
            text(' odd', [{ type: 'textStyle', attrs: { color: 'red; background: url(x)' } }]),
            text(' lit', [{ type: 'highlight', attrs: { color: 'var(--color-yellow-3)' } }]),
          ),
          { type: 'image', attrs: { src: 'javascript:alert(1)', alt: 'x' } },
        )}
      </Prose>,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(root(container)).toHaveTextContent('run red odd lit');
    expect(screen.getByText('red').style.color).toBe('var(--color-red-9)');
    expect(screen.getByText('odd').getAttribute('style')).toBeNull();
    expect(container.querySelector('mark')).toHaveAttribute('data-color', 'var(--color-yellow-3)');
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders nothing for a document with nothing in it', () => {
    const { container } = render(
      <Prose>{JSON.stringify(doc(paragraph(), paragraph(text(' '))))}</Prose>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('draws a stored document that no longer parses as the text it is', () => {
    render(<Prose>{'{"type":"doc", broken'}</Prose>);
    expect(screen.getByText('{"type":"doc", broken')).toBeInTheDocument();
  });

  it('keeps the editor’s alignment and a list’s start', () => {
    const { container } = render(
      <Prose>
        {doc(
          { type: 'paragraph', attrs: { textAlign: 'center' }, content: [text('middle')] },
          {
            type: 'orderedList',
            attrs: { start: 3 },
            content: [{ type: 'listItem', content: [paragraph(text('third'))] }],
          },
        )}
      </Prose>,
    );
    expect(screen.getByText('middle').style.textAlign).toBe('center');
    expect(container.querySelector('ol')).toHaveAttribute('start', '3');
  });
});

// Showing text must never load the editor: Prose takes only @bh/richtext's
// types, which the build erases, and nothing of Tiptap.
describe('Prose’s modules', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const IMPORT = /^import\s+(type\s+)?[^'"]*?from\s+'([^']+)'/gm;

  it('import nothing of @bh/richtext but its types, and nothing of Tiptap', () => {
    const loaded: string[] = [];
    for (const file of ['prose.tsx', 'document.tsx', 'nodes.tsx', 'index.ts']) {
      for (const [, type, specifier = ''] of readFileSync(resolve(HERE, file), 'utf8').matchAll(
        IMPORT,
      )) {
        if (type === undefined) {
          loaded.push(specifier);
        }
      }
    }
    expect(loaded.filter((name) => /^(@bh\/richtext|@tiptap)/.test(name))).toEqual([]);
    expect(loaded).toContain('@bh/ui');
  });
});
