import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor, type Composer } from '.';
import { docOf, Held, paragraph, parsed, textbox } from './test/held';

// While pending, the spinner's words come before the label.
const send = () => screen.getByRole('button', { name: /Send$/ });

describe('the composer', () => {
  it('puts the toolbar in a row under the text, then the ⌘↩ hint and the submit button', () => {
    const { container } = render(<Held features="compact" composer={{ onSubmit: vi.fn() }} />);
    const field = container.firstElementChild as HTMLElement;
    const text = field.querySelector('.rt');
    const row = text?.nextElementSibling as HTMLElement;
    // The text first, then the row: the toolbar, the hint, the button.
    expect(row).toContainElement(screen.getByRole('toolbar', { name: 'Formatting' }));
    const parts = [...row.children];
    expect(parts.map((part) => part.tagName)).toEqual(['DIV', 'KBD', 'BUTTON']);
    expect(parts[0]).toHaveAttribute('role', 'toolbar');
    expect(parts[1]).toHaveAttribute('aria-hidden', 'true');
    expect(parts[2]).toBe(send());
    expect(send()).toHaveAttribute('aria-keyshortcuts', 'Meta+Enter Control+Enter');
    expect(within(row).getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  });

  it('names its button as the page says', () => {
    render(<Held composer={{ onSubmit: vi.fn(), submitLabel: 'Comment' }} />);
    expect(screen.getByRole('button', { name: 'Comment' })).toBeInTheDocument();
  });

  it('sends the live document from its button', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Held features="compact" composer={{ onSubmit }} />);
    await user.click(textbox());
    await user.keyboard('hi');
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(parsed(onSubmit.mock.lastCall?.[0])).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
    });
  });

  // The page can render behind the typing: the send reads the editor, not `value`.
  it('sends what the editor holds, even before the page has caught up', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RichTextEditor label="Body" value="" onChange={vi.fn()} composer={{ onSubmit }} />);
    await user.click(textbox());
    await user.keyboard('not yet in value');
    await user.click(send());
    expect(parsed(onSubmit.mock.lastCall?.[0]).content?.[0]?.content?.[0]?.text).toBe(
      'not yet in value',
    );
  });

  it('sends on ⌘↩ (Mod-Enter) instead of breaking the line', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    render(<Held features="compact" composer={{ onSubmit }} onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('hi{Meta>}{Enter}{/Meta}');
    expect(onSubmit).toHaveBeenCalledOnce();
    // Still one paragraph, and no hard break: the key was the send's.
    const doc = parsed(onSubmit.mock.lastCall?.[0]);
    expect(doc.content).toHaveLength(1);
    expect(doc.content?.[0]?.content).toEqual([{ type: 'text', text: 'hi' }]);
    expect(textbox().querySelector('br:not(.ProseMirror-trailingBreak)')).toBeNull();

    await user.keyboard('{Control>}{Enter}{/Control}');
    // Sent once already, and nothing changed since: Ctrl+Enter is the send too.
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(textbox().querySelectorAll('p')).toHaveLength(1);
  });

  it('leaves ⌘↩ to the hard break when the editor is no composer', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('a{Meta>}{Enter}{/Meta}b');
    const doc = parsed(onChange.mock.lastCall?.[0]);
    expect(doc.content?.[0]?.content?.map((node) => node.type)).toEqual([
      'text',
      'hardBreak',
      'text',
    ]);
  });

  it('sends nothing while pending or disabled, from the key or the button', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <RichTextEditor
        label="Body"
        value={docOf(paragraph('ready'))}
        onChange={vi.fn()}
        composer={{ onSubmit, submitPending: true }}
      />,
    );
    await user.click(textbox());
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    expect(send()).toBeDisabled();
    expect(send()).toHaveAttribute('aria-busy', 'true');

    rerender(
      <RichTextEditor
        label="Body"
        value={docOf(paragraph('ready'))}
        onChange={vi.fn()}
        composer={{ onSubmit, submitDisabled: true }}
      />,
    );
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    expect(send()).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
    // Still one paragraph: the key did nothing else either.
    expect(textbox().querySelectorAll('p')).toHaveLength(1);
  });

  it('sends nothing on a held key’s repeats', () => {
    const onSubmit = vi.fn();
    render(<Held initial={docOf(paragraph('held'))} composer={{ onSubmit }} />);
    fireEvent.keyDown(textbox(), { key: 'Enter', metaKey: true, repeat: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(textbox(), { key: 'Enter', metaKey: true });
    fireEvent.keyDown(textbox(), { key: 'Enter', metaKey: true, repeat: true });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('sends once for two presses before the page catches up', () => {
    const onSubmit = vi.fn();
    render(<Held initial={docOf(paragraph('once'))} composer={{ onSubmit }} />);
    fireEvent.keyDown(textbox(), { key: 'Enter', metaKey: true });
    fireEvent.keyDown(textbox(), { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('sends nothing while the text holds nothing', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Held composer={{ onSubmit }} />);
    fireEvent.keyDown(textbox(), { key: 'Enter', metaKey: true });
    await user.click(send());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // A page that sends, waits, and clears the box, as a comment box does.
  function CommentBox({ onSubmit }: { onSubmit: (value: string) => void }) {
    const [value, setValue] = useState('');
    const [pending, setPending] = useState(false);
    const composer: Composer = {
      submitLabel: 'Comment',
      submitPending: pending,
      onSubmit: (next) => {
        onSubmit(next);
        setPending(true);
        queueMicrotask(() => {
          setPending(false);
          setValue('');
        });
      },
    };
    return <RichTextEditor label="Body" value={value} onChange={setValue} composer={composer} />;
  }

  it('sends again once the page has taken the last one and cleared the box', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CommentBox onSubmit={onSubmit} />);
    await user.click(textbox());
    await user.keyboard('first{Meta>}{Enter}{/Meta}');
    expect(await screen.findByRole('button', { name: 'Comment' })).toBeEnabled();
    expect(textbox()).toHaveTextContent('');
    await user.keyboard('second{Meta>}{Enter}{/Meta}');
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(parsed(onSubmit.mock.lastCall?.[0]).content?.[0]?.content?.[0]?.text).toBe('second');
  });

  it('takes the focus in its order: the text, the toolbar’s one stop, the button', async () => {
    const user = userEvent.setup();
    render(
      <Held
        features="compact"
        initial={docOf(paragraph('ready'))}
        composer={{ onSubmit: vi.fn() }}
      />,
    );
    await user.tab();
    expect(textbox()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('toolbar')).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Italic' }));
    await user.tab();
    expect(send()).toHaveFocus();
  });

  it('turns its button off with the editor, and shows no row while read-only', () => {
    const composer = { onSubmit: vi.fn() };
    const { rerender } = render(
      <RichTextEditor label="Body" value="" onChange={vi.fn()} disabled composer={composer} />,
    );
    expect(send()).toBeDisabled();
    expect(screen.queryByRole('toolbar')).toBeNull();
    rerender(
      <RichTextEditor label="Body" value="" onChange={vi.fn()} readOnly composer={composer} />,
    );
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });
});
