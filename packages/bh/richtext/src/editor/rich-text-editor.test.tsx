import { Mention } from '@tiptap/extension-mention';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRichText, type DocNode, type InlineNode } from '../index';
import { RichTextEditor, type RichTextEditorProps } from '.';

const docOf = (...blocks: DocNode[]) => JSON.stringify({ type: 'doc', content: blocks });
const paragraph = (text: string): DocNode => {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
};
const textbox = () => screen.getByRole('textbox');

/** The text of the document a value stands for, block by block. */
const blocksOf = (value: string): string[] => {
  const doc = JSON.parse(value) as DocNode;
  return (doc.content ?? []).map((block) => {
    return (block.content ?? []).map((inline) => inline.text ?? '').join('');
  });
};

type HeldProps = Partial<RichTextEditorProps> & { initial?: string };

/** Feeds each change back into `value`, as a form does. */
function Held({ initial = '', onChange, ...rest }: HeldProps) {
  const [value, setValue] = useState(initial);
  return (
    <RichTextEditor
      label="Body"
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

// An app's own node, as tickets adds its ticket reference: `#TIX-9`, a chip.
const ticketRef: InlineNode = {
  name: 'ticketRef',
  feature: 'mentions',
  extensions: (suggestion) => {
    return [
      Mention.extend({ name: 'ticketRef' }).configure({
        renderHTML: ({ node }) => {
          const label = String(node.attrs['label'] ?? '');
          return ['span', { 'data-ticket-ref': label }, label];
        },
        suggestion: { char: '#', ...suggestion },
      }),
    ];
  },
  markdown: {
    pattern: /(?<![\w#])#([A-Z][A-Z0-9]*-\d+)/,
    parse: (match) => ({ type: 'ticketRef', attrs: { id: null, label: match[1] ?? '' } }),
    serialize: (node) => `#${String(node.attrs?.['label'] ?? '')}`,
  },
};
const tickets = createRichText({ nodes: [ticketRef] });

describe('RichTextEditor', () => {
  it('shows a stored document, and reads markdown as one', () => {
    const { unmount } = render(
      <RichTextEditor label="Body" value={docOf(paragraph('from a doc'))} onChange={vi.fn()} />,
    );
    expect(textbox()).toHaveTextContent('from a doc');
    unmount();

    render(<RichTextEditor label="Body" value={'# Title\n\nbody'} onChange={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title');
    expect(textbox()).toHaveTextContent('body');
  });

  it('reports each edit as the document’s JSON', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('abc');
    expect(textbox()).toHaveTextContent('abc');
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(blocksOf(String(onChange.mock.lastCall?.[0]))).toEqual(['abc']);
  });

  it('reports a document emptied of its text as an empty value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held initial={docOf(paragraph('some text'))} onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('{Control>}a{/Control}{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('takes a new value from the page without reporting it as an edit', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <RichTextEditor label="Body" value={docOf(paragraph('first'))} onChange={onChange} />,
    );
    rerender(<RichTextEditor label="Body" value="second, as **markdown**" onChange={onChange} />);
    expect(textbox()).toHaveTextContent('second, as markdown');
    expect(textbox().querySelector('strong')).toHaveTextContent('markdown');
    rerender(<RichTextEditor label="Body" value="" onChange={onChange} />);
    expect(textbox()).toHaveTextContent('');
    expect(onChange).not.toHaveBeenCalled();
  });

  // The page renders after the editor's update, and can be an edit or two
  // behind: the value that comes back is then an earlier one, and loading it
  // would drop what was typed since.
  it('keeps what was typed when its own edits come back late', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('one two{Enter}three');
    expect(blocksOf(String(onChange.mock.lastCall?.[0]))).toEqual(['one two', 'three']);
    expect(textbox()).toHaveTextContent('one twothree');
  });

  it('draws an app’s own inline node, from markdown and from a document', () => {
    const { unmount } = render(
      <RichTextEditor
        label="Body"
        richText={tickets}
        value="Blocked by #TIX-9, ask @beka."
        onChange={vi.fn()}
      />,
    );
    expect(textbox().querySelector('[data-ticket-ref="TIX-9"]')).toHaveTextContent('TIX-9');
    expect(textbox().querySelector('[data-mention="beka"]')).not.toBeNull();
    unmount();

    const stored = docOf({
      type: 'paragraph',
      content: [{ type: 'ticketRef', attrs: { id: null, label: 'TIX-4' } }],
    });
    render(<RichTextEditor label="Body" richText={tickets} value={stored} onChange={vi.fn()} />);
    expect(textbox().querySelector('[data-ticket-ref="TIX-4"]')).not.toBeNull();
  });

  it('reads an app’s node as text when made without the app’s rich text', () => {
    render(<RichTextEditor label="Body" value="Blocked by #TIX-9." onChange={vi.fn()} />);
    expect(textbox()).toHaveTextContent('Blocked by #TIX-9.');
    expect(textbox().querySelector('[data-ticket-ref]')).toBeNull();
  });

  it('shows what its features leave out as text, rather than losing it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onChange = vi.fn();
    render(
      <RichTextEditor
        label="Comment"
        features="compact"
        value={'# Title\n\n> quoted\n\nbody'}
        onChange={onChange}
      />,
    );
    expect(screen.queryByRole('heading')).toBeNull();
    expect(textbox()).toHaveTextContent('Title');
    expect(textbox()).toHaveTextContent('quoted');
    expect(textbox()).toHaveTextContent('body');
    expect(warn).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps its editor when the same features are spelled again, and its text when they change', () => {
    const value = docOf(paragraph('kept'));
    const { rerender } = render(
      <RichTextEditor label="Body" features={['marks']} value={value} onChange={vi.fn()} />,
    );
    const first = textbox();
    rerender(<RichTextEditor label="Body" features={['marks']} value={value} onChange={vi.fn()} />);
    expect(textbox()).toBe(first);

    rerender(
      <RichTextEditor
        label="Body"
        features={['marks', 'lists']}
        value={value}
        onChange={vi.fn()}
      />,
    );
    expect(textbox()).toHaveTextContent('kept');
  });

  it('shows its placeholder while it holds nothing, and a new one at once', () => {
    const { rerender } = render(
      <RichTextEditor label="Body" value="" placeholder="Write…" onChange={vi.fn()} />,
    );
    const empty = () => textbox().querySelector('.is-editor-empty');
    expect(empty()).toHaveAttribute('data-placeholder', 'Write…');
    expect(textbox()).toHaveAttribute('aria-placeholder', 'Write…');

    rerender(<RichTextEditor label="Body" value="" placeholder="Reply…" onChange={vi.fn()} />);
    expect(empty()).toHaveAttribute('data-placeholder', 'Reply…');

    rerender(<RichTextEditor label="Body" value="text" placeholder="Reply…" onChange={vi.fn()} />);
    expect(empty()).toBeNull();
  });

  it('is a multi-line textbox, named and described as a field is', () => {
    const { rerender } = render(
      <RichTextEditor
        id="body"
        label="Body"
        aria-describedby="body-help"
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(textbox()).toHaveAttribute('aria-multiline', 'true');
    expect(textbox()).toHaveAttribute('id', 'body');
    expect(textbox()).toHaveAttribute('aria-label', 'Body');
    expect(textbox()).toHaveAttribute('aria-describedby', 'body-help');

    rerender(<RichTextEditor label="Body" labelledBy="body-label" value="" onChange={vi.fn()} />);
    expect(textbox()).toHaveAttribute('aria-labelledby', 'body-label');
    expect(textbox()).not.toHaveAttribute('aria-label');
  });

  it('is invalid when its tone is danger, and only then', () => {
    const { rerender } = render(<RichTextEditor label="Body" value="" onChange={vi.fn()} />);
    expect(textbox()).not.toHaveAttribute('aria-invalid');
    rerender(<RichTextEditor label="Body" tone="success" value="" onChange={vi.fn()} />);
    expect(textbox()).not.toHaveAttribute('aria-invalid');
    rerender(<RichTextEditor label="Body" tone="danger" value="" onChange={vi.fn()} />);
    expect(textbox()).toHaveAttribute('aria-invalid', 'true');
  });

  it('takes the focus from Tab and from a press in its box', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor label="Body" value="" onChange={vi.fn()} />);
    // Its toolbar comes first, one tab stop.
    await user.tab();
    expect(screen.getByRole('toolbar')).toContainElement(document.activeElement as HTMLElement);
    await user.tab();
    expect(textbox()).toHaveFocus();
    await user.tab();
    expect(textbox()).not.toHaveFocus();
    await user.click(textbox());
    expect(textbox()).toHaveFocus();
  });

  it('takes no edits and no focus while disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor
        label="Body"
        value={docOf(paragraph('locked'))}
        disabled
        onChange={onChange}
      />,
    );
    expect(textbox()).toHaveAttribute('contenteditable', 'false');
    expect(textbox()).toHaveAttribute('aria-disabled', 'true');
    expect(textbox()).not.toHaveAttribute('tabindex');
    await user.tab();
    expect(textbox()).not.toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes no edits while read-only, but keeps its tab stop', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RichTextEditor label="Body" value={docOf(paragraph('read'))} readOnly onChange={onChange} />,
    );
    expect(textbox()).toHaveAttribute('contenteditable', 'false');
    expect(textbox()).toHaveAttribute('aria-readonly', 'true');
    await user.tab();
    expect(textbox()).toHaveFocus();
    await user.keyboard('more');
    expect(textbox()).toHaveTextContent('read');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is locked and unlocked without reporting a change', () => {
    const onChange = vi.fn();
    const props = { label: 'Body', value: docOf(paragraph('text')), onChange };
    const { rerender } = render(<RichTextEditor {...props} />);
    expect(textbox()).toHaveAttribute('contenteditable', 'true');
    rerender(<RichTextEditor {...props} disabled />);
    expect(textbox()).toHaveAttribute('contenteditable', 'false');
    rerender(<RichTextEditor {...props} readOnly />);
    expect(textbox()).toHaveAttribute('tabindex', '0');
    rerender(<RichTextEditor {...props} />);
    expect(textbox()).toHaveAttribute('contenteditable', 'true');
    expect(textbox()).not.toHaveAttribute('aria-readonly');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('says so when a stored document no longer parses, and shows it as text', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<RichTextEditor label="Body" value={'{"type":"doc", broken'} onChange={vi.fn()} />);
    expect(error).toHaveBeenCalledOnce();
    expect(textbox()).toHaveTextContent('{"type":"doc", broken');
  });
});
