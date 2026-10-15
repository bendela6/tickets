import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DocNode } from '../detect';
import { RichTextEditor } from '.';
import { docOf, Held, paragraph, parsed, textbox } from './test/held';

const toolbar = () => screen.getByRole('toolbar', { name: 'Formatting' });
const tool = (name: string | RegExp) => within(toolbar()).getByRole('button', { name });
/** A menu's row by its name, whichever kind of row it is. */
const item = (name: string) => {
  const rows = ['menuitem', 'menuitemradio', 'menuitemcheckbox'].flatMap((role) => {
    return screen.queryAllByRole(role, { name });
  });
  expect(rows).toHaveLength(1);
  return rows[0] as HTMLElement;
};

/** Every node of a document, depth first. */
const nodesOf = (doc: DocNode): DocNode[] => [doc, ...(doc.content ?? []).flatMap(nodesOf)];
const lastDoc = (onChange: ReturnType<typeof vi.fn>) => parsed(onChange.mock.lastCall?.[0]);

describe('the toolbar', () => {
  it('draws the controls its features make, and nothing for what they leave out', () => {
    const { rerender } = render(
      <RichTextEditor label="Body" features={['marks']} value="" onChange={vi.fn()} />,
    );
    const names = () => {
      return within(toolbar())
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'));
    };
    expect(names()).toEqual([
      'Bold',
      'Italic',
      'Underline',
      'Strikethrough',
      'Code',
      'More formatting',
    ]);

    rerender(<RichTextEditor label="Body" features="full" value="" onChange={vi.fn()} />);
    expect(names()).toEqual([
      'Text style: Paragraph',
      'Bold',
      'Italic',
      'Underline',
      'Strikethrough',
      'Code',
      'Link',
      'List',
      'Quote',
      'Code block',
      'More formatting',
    ]);
    // A separator between each group.
    expect(within(toolbar()).getAllByRole('separator')).toHaveLength(5);

    // Features with no control (a table, alignment) make no toolbar.
    rerender(
      <RichTextEditor label="Body" features={['table', 'align']} value="" onChange={vi.fn()} />,
    );
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('is not there while the text is disabled or read-only', () => {
    const props = { label: 'Body', value: '', onChange: vi.fn() };
    const { rerender } = render(<RichTextEditor {...props} disabled />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    rerender(<RichTextEditor {...props} readOnly />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    rerender(<RichTextEditor {...props} />);
    expect(toolbar()).toBeInTheDocument();
  });

  it('lights the marks on at the selection, and a press toggles one there', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held initial={docOf(paragraph('loud', [{ type: 'bold' }]))} onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('{Control>}a{/Control}');
    expect(tool('Bold')).toHaveAttribute('aria-pressed', 'true');
    expect(tool('Italic')).toHaveAttribute('aria-pressed', 'false');

    await user.click(tool('Bold'));
    expect(tool('Bold')).toHaveAttribute('aria-pressed', 'false');
    expect(textbox().querySelector('strong')).toBeNull();
    expect(nodesOf(lastDoc(onChange)).some((node) => node.marks?.length)).toBe(false);
    // Pressed with the pointer, it leaves the focus, and the selection, in the text.
    expect(textbox()).toHaveFocus();

    await user.click(tool('Italic'));
    expect(textbox().querySelector('em')).toHaveTextContent('loud');
    expect(tool('Italic')).toHaveAttribute('aria-pressed', 'true');
  });

  it('is one tab stop, the arrow keys, Home and End moving along it', async () => {
    const user = userEvent.setup();
    render(<RichTextEditor label="Body" features={['marks']} value="" onChange={vi.fn()} />);
    const stops = () => {
      return within(toolbar())
        .getAllByRole('button')
        .filter((b) => b.tabIndex === 0);
    };

    await user.tab();
    expect(tool('Bold')).toHaveFocus();
    expect(stops()).toEqual([tool('Bold')]);
    await user.keyboard('{ArrowRight}');
    expect(tool('Italic')).toHaveFocus();
    await user.keyboard('{End}');
    expect(tool('More formatting')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tool('Bold')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(tool('More formatting')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tool('Bold')).toHaveFocus();

    // It keeps the stop where the focus left it.
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(stops()).toEqual([tool('Underline')]);
    await user.tab();
    expect(textbox()).toHaveFocus();
    await user.tab({ shift: true });
    expect(tool('Underline')).toHaveFocus();
  });

  it('keeps the focus on a toggle pressed with the keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held initial={docOf(paragraph('plain'))} features={['marks']} onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('{Control>}a{/Control}');
    await user.tab({ shift: true });
    expect(tool('Bold')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(tool('Bold')).toHaveFocus();
    expect(tool('Bold')).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{ArrowRight}{Enter}');
    expect(textbox().querySelector('strong em, em strong')).toHaveTextContent('plain');
  });

  it('sets the text style from its menu, by keys, and names the one on', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Held initial={docOf(paragraph('Title'))} features={['headings']} onChange={onChange} />,
    );
    await user.tab();
    expect(tool('Text style: Paragraph')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(item('Paragraph')).toHaveAttribute('aria-checked', 'true');
    expect(item('Paragraph')).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Title');
    expect(lastDoc(onChange).content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
    // Picked with the keys, the focus goes back to the menu's button.
    expect(tool('Text style: Heading 2')).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(item('Heading 2')).toHaveAttribute('aria-checked', 'true');
    expect(item('Paragraph')).toHaveAttribute('aria-checked', 'false');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(tool('Text style: Heading 2')).toHaveFocus();
  });

  it('opens a submenu by keys: More formatting, Text colour, a colour', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held initial={docOf(paragraph('warm'))} features={['marks']} onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('{Control>}a{/Control}');
    await user.tab({ shift: true });
    await user.keyboard('{End}{Enter}');
    expect(item('Highlight')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Text colour')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(item('Default')).toHaveFocus();
    expect(item('Default')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(screen.queryByRole('menu')).toBeNull();
    const text = nodesOf(lastDoc(onChange)).find((node) => node.text === 'warm');
    expect(text?.marks).toEqual([{ type: 'textStyle', attrs: { color: 'var(--color-red-9)' } }]);
    expect(tool('More formatting')).toHaveFocus();
  });

  it('gives the text the focus back after a pick with the pointer', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held initial={docOf(paragraph('above'))} features={['divider']} onChange={onChange} />);
    await user.click(textbox());
    await user.click(tool('More formatting'));
    await user.click(item('Divider'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(textbox()).toHaveFocus();
    expect(nodesOf(lastDoc(onChange)).map((node) => node.type)).toContain('horizontalRule');
  });

  it('groups the lists in a menu, the one on checked; a single kind is a toggle', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(
      <Held
        initial={docOf(paragraph('step'))}
        features={['lists', 'taskList']}
        onChange={onChange}
      />,
    );
    await user.click(textbox());
    await user.click(tool('List'));
    expect(screen.getAllByRole('menuitemradio').map((row) => row.textContent)).toEqual([
      'Bulleted list',
      'Numbered list',
      'Task list',
    ]);
    await user.click(item('Numbered list'));
    expect(lastDoc(onChange).content?.[0]?.type).toBe('orderedList');
    expect(tool('List: Numbered list')).toBeInTheDocument();

    // The one on, picked again, takes the list away.
    await user.click(tool('List: Numbered list'));
    expect(item('Numbered list')).toHaveAttribute('aria-checked', 'true');
    await user.click(item('Numbered list'));
    expect(lastDoc(onChange).content?.[0]?.type).toBe('paragraph');
    unmount();

    render(<Held initial={docOf(paragraph('todo'))} features={['taskList']} />);
    await user.click(textbox());
    await user.click(tool('Task list'));
    expect(tool('Task list')).toHaveAttribute('aria-pressed', 'true');
  });

  it('wraps the text in a callout of a kind, repaints it, and takes it away', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held initial={docOf(paragraph('note'))} features={['callout']} onChange={onChange} />);
    // By keys: jsdom lays nothing out, so a pointer crossing to a submenu
    // leaves radix's grace area at once and closes it.
    const pick = async (kind: string) => {
      tool('More formatting').focus();
      await user.keyboard('{Enter}');
      expect(item('Callout')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(item('Info')).toHaveFocus();
      for (let step = 0; step < 4 && document.activeElement?.textContent !== kind; step += 1) {
        await user.keyboard('{ArrowDown}');
      }
      await user.keyboard('{Enter}');
    };
    await user.click(textbox());
    await pick('Warning');
    expect(lastDoc(onChange).content?.[0]).toMatchObject({
      type: 'callout',
      attrs: { kind: 'warning' },
    });
    await pick('Danger');
    expect(lastDoc(onChange).content?.[0]).toMatchObject({
      type: 'callout',
      attrs: { kind: 'danger' },
    });
    await pick('Danger');
    expect(lastDoc(onChange).content?.[0]?.type).toBe('paragraph');
  });
});
