import { Mention } from '@tiptap/extension-mention';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DocNode } from '../detect';
import { createRichText, type InlineNode } from '../index';
import { SLASH_COMMANDS, type SuggestionItem } from '.';
import { matchCommands } from './suggestions';
import { Held, parsed, textbox } from './test/held';

/** Every node of a document, depth first. */
const nodesOf = (doc: DocNode): DocNode[] => [doc, ...(doc.content ?? []).flatMap(nodesOf)];
const lastDoc = (onChange: ReturnType<typeof vi.fn>) => parsed(onChange.mock.lastCall?.[0]);
const options = () => screen.getAllByRole('option').map((option) => option.textContent);

const PEOPLE: SuggestionItem[] = [
  { id: 1, label: 'ana', description: '@ana' },
  { id: 2, label: 'beka', description: '@beka' },
  { id: 3, label: 'cy', description: '@cy' },
];
const people = {
  label: 'People',
  items: (query: string) => PEOPLE.filter((person) => person.label.includes(query)),
};

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
};
const tickets = createRichText({ nodes: [ticketRef] });

describe('suggestions', () => {
  it('open the app’s list on @, at the caret, and Enter inserts the picked chip', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held suggestions={{ mention: people }} onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('Hi @be');

    const list = await screen.findByRole('listbox', { name: 'People' });
    expect(options()).toEqual(['beka@beka']);
    // The text points at the list and at the row the cursor is on.
    expect(textbox()).toHaveAttribute('aria-controls', list.id);
    expect(textbox()).toHaveAttribute('aria-activedescendant', screen.getByRole('option').id);
    expect(textbox()).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(textbox()).not.toHaveAttribute('aria-activedescendant');
    expect(textbox().querySelector('[data-mention="beka"]')).not.toBeNull();
    const chip = nodesOf(lastDoc(onChange)).find((node) => node.type === 'mention');
    expect(chip?.attrs).toMatchObject({ id: 2, label: 'beka' });
    await user.keyboard('there');
    expect(textbox()).toHaveTextContent('Hi BEbeka there');
  });

  it('move the cursor with the arrows, wrapping, and pick with Tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held suggestions={{ mention: people }} onChange={onChange} />);
    await user.click(textbox());
    await user.keyboard('@');
    await screen.findByRole('listbox');
    const active = () => {
      return document.getElementById(textbox().getAttribute('aria-activedescendant') ?? '');
    };
    expect(active()).toHaveTextContent('ana');
    await user.keyboard('{ArrowDown}');
    expect(active()).toHaveTextContent('beka');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(active()).toHaveTextContent('cy');
    await user.keyboard('{Tab}');
    expect(nodesOf(lastDoc(onChange)).find((node) => node.type === 'mention')?.attrs).toMatchObject(
      {
        label: 'cy',
      },
    );
    expect(textbox()).toHaveFocus();
  });

  it('close on Escape, keeping what was typed', async () => {
    const user = userEvent.setup();
    render(<Held suggestions={{ mention: people }} />);
    await user.click(textbox());
    await user.keyboard('@be');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(textbox()).toHaveTextContent('@be');
    expect(textbox()).toHaveFocus();
  });

  it('take items the app finds later, saying it is looking until they come', async () => {
    const user = userEvent.setup();
    let found: (items: SuggestionItem[]) => void = () => {};
    const items = vi.fn((query: string) => {
      void query;
      return new Promise<SuggestionItem[]>((resolve) => {
        found = resolve;
      });
    });
    render(<Held suggestions={{ mention: { items } }} />);
    await user.click(textbox());
    await user.keyboard('@m');
    expect(await screen.findByRole('status')).toHaveTextContent('Looking…');
    expect(items).toHaveBeenLastCalledWith('m');
    found([{ id: 'u7', label: 'mara' }]);
    expect(await screen.findByRole('option', { name: 'mara' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('say so when the app has nothing for what was typed', async () => {
    const user = userEvent.setup();
    render(<Held suggestions={{ mention: people }} />);
    await user.click(textbox());
    await user.keyboard('@zz');
    expect(await screen.findByRole('status')).toHaveTextContent('No matches');
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('open an app’s own node’s list on its trigger; a pressed row inserts its chip with its attributes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const items = vi.fn(() => {
      return [
        {
          id: 42,
          label: 'TIX-42',
          description: 'Fix the thing',
          leading: <span data-testid="status-dot" />,
          attrs: { id: 42 },
        },
      ];
    });
    render(
      <Held
        richText={tickets}
        suggestions={{ ticketRef: { label: 'Tickets', items } }}
        onChange={onChange}
      />,
    );
    await user.click(textbox());
    await user.keyboard('see #42');
    const list = await screen.findByRole('listbox', { name: 'Tickets' });
    expect(items).toHaveBeenLastCalledWith('42');
    expect(within(list).getByTestId('status-dot')).toBeInTheDocument();
    expect(within(list).getByRole('option')).toHaveTextContent('TIX-42Fix the thing');

    await user.click(within(list).getByRole('option'));
    expect(textbox().querySelector('[data-ticket-ref="TIX-42"]')).not.toBeNull();
    expect(
      nodesOf(lastDoc(onChange)).find((node) => node.type === 'ticketRef')?.attrs,
    ).toMatchObject({
      id: 42,
      label: 'TIX-42',
    });
    expect(textbox()).toHaveFocus();
  });

  it('open no list for a trigger the app gives nothing for', async () => {
    const user = userEvent.setup();
    render(<Held />);
    await user.click(textbox());
    await user.keyboard('@be #4 /h');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mention' })).toBeNull();
  });

  it('start a mention from the toolbar’s @, while the app suggests people', async () => {
    const user = userEvent.setup();
    render(<Held suggestions={{ mention: people }} features="compact" />);
    await user.click(textbox());
    await user.keyboard('ask');
    await user.click(screen.getByRole('button', { name: 'Mention' }));
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeInTheDocument();
    expect(textbox()).toHaveTextContent('ask @');
    expect(textbox()).toHaveFocus();
  });
});

describe('the / commands', () => {
  it('list bh’s commands for the editor’s features, and a pick runs one in place of what was typed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Held slashCommands features={['headings', 'lists']} onChange={onChange} />);
    await user.click(textbox());
    // A `/` inside a word opens nothing.
    await user.keyboard('and/or');
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.keyboard(' /');
    await screen.findByRole('listbox', { name: 'Commands' });
    const commands = [
      'Text',
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Bulleted list',
      'Numbered list',
    ];
    expect(screen.getAllByRole('option')).toHaveLength(commands.length);
    for (const name of commands) {
      expect(screen.getByRole('option', { name })).toBeInTheDocument();
    }
    await user.keyboard('h2');
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Heading 2');
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(lastDoc(onChange).content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
    expect(lastDoc(onChange).content?.[0]?.content).toEqual([{ type: 'text', text: 'and/or ' }]);
  });

  it('take the app’s own commands, beside bh’s, offering only what the features allow', async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    render(
      <Held
        features={['marks']}
        slashCommands={[...SLASH_COMMANDS, { id: 'today', label: 'Today’s date', run }]}
      />,
    );
    await user.click(textbox());
    await user.keyboard('/');
    await screen.findByRole('listbox', { name: 'Commands' });
    expect(options()).toEqual(['Today’s date']);
    await user.keyboard('{Enter}');
    expect(run).toHaveBeenCalledOnce();
  });

  it('are off unless asked for', async () => {
    const user = userEvent.setup();
    render(<Held features="full" />);
    await user.click(textbox());
    await user.keyboard('/');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('match a command by its label or its words, the ones starting so first', () => {
    const names = (query: string) => matchCommands(SLASH_COMMANDS, query).map((c) => c.label);
    expect(names('h1')).toEqual(['Heading 1']);
    expect(names('list').slice(0, 3)).toEqual(['Bulleted list', 'Numbered list', 'Task list']);
    expect(names('quo')).toEqual(['Quote']);
    expect(names('ide')).toEqual(['Divider']);
    expect(names('')).toHaveLength(SLASH_COMMANDS.length);
  });
});
