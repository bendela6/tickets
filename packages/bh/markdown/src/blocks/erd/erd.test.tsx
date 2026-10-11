import { createRegistry, toExample, type RenderContext } from '../../registry';
import { MarkdownDoc } from '../../render';
import { pageMarkdown, parsePage } from '../../page';
import { validateDocument } from '../../validate';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { markdownBlocks } from '..';
import { erdExamples } from './examples';
import { COLUMN_WIDTH, ORIGIN } from './layout';
import { erdBlock } from './renderer';
import { readErd, type ErdLayout } from './schema';

// Filtered, so this still builds once `erd` is among markdownBlocks itself.
const registry = createRegistry([
  ...markdownBlocks.filter((block) => block.name !== 'erd'),
  erdBlock,
]);

const src = [
  '```erd',
  'title: Core schema',
  'tables:',
  '  users:',
  '    columns:',
  '      id: { type: uuid, pk: true }',
  '  orders:',
  '    columns:',
  '      user_id: { type: uuid, ref: users.id }',
  '```',
].join('\n');

/** A ctx whose host records what it is told, keyed by diagram title. */
function host(kept?: Record<string, ErdLayout>) {
  const seen: [string, ErdLayout][] = [];
  const ctx: RenderContext = {
    erdLayout: kept,
    onErdLayoutChange: (key: string, layout: ErdLayout) => seen.push([key, layout]),
  };
  return { ctx, seen };
}

const handle = (name: string) => screen.getByRole('button', { name });
const card = (name: string) => screen.getByTestId(`erd-table-${name}`);

/** Presses on a card's name and lets go `dx`, `dy` screen pixels away. */
function dragBy(name: string, dx: number, dy: number) {
  fireEvent.pointerDown(screen.getByText(name), { clientX: 0, clientY: 0 });
  fireEvent.pointerMove(handle(name), { clientX: dx, clientY: dy });
  fireEvent.pointerUp(handle(name), { clientX: dx, clientY: dy });
}

describe('erd', () => {
  it('renders a card per table, its columns as a table named by it', () => {
    render(<MarkdownDoc source={src} registry={registry} />);
    const users = screen.getByRole('table', { name: 'users' });
    const orders = screen.getByRole('table', { name: 'orders' });
    expect(within(users).getByRole('rowheader')).toHaveTextContent('id');
    expect(within(orders).getByRole('rowheader')).toHaveTextContent('user_id');
    expect(screen.getAllByText('uuid')).toHaveLength(2);
    expect(screen.getByText('Core schema')).toBeInTheDocument();
    expect(screen.getByText(/2 tables/)).toBeInTheDocument();
  });

  it('flags the primary key, foreign key and unique columns, and says what each means', () => {
    const flags = src.replace(
      '      id: { type: uuid, pk: true }',
      ['      id: { type: uuid, pk: true }', '      email: { type: text, unique: true }'].join(
        '\n',
      ),
    );
    render(<MarkdownDoc source={flags} registry={registry} />);
    expect(screen.getByText('PK')).toBeInTheDocument();
    expect(screen.getByText('FK')).toBeInTheDocument();
    expect(screen.getByText('UQ')).toBeInTheDocument();
    const keys = screen.getAllByRole('row').map((row) => row.getAttribute('data-key'));
    expect(keys).toEqual(['pk', 'unique', 'fk']);
    const fk = screen.getAllByRole('row')[2];
    expect(fk).toHaveTextContent('references users.id');
  });

  it('shows the primary key flag on a column that is also a foreign key, and says both', () => {
    const both = src.replace(
      'user_id: { type: uuid, ref: users.id }',
      'user_id: { type: uuid, pk: true, ref: users.id }',
    );
    render(<MarkdownDoc source={both} registry={registry} />);
    const row = within(screen.getByRole('table', { name: 'orders' })).getByRole('row');
    expect(row).toHaveAttribute('data-key', 'pk');
    expect(row).toHaveTextContent('primary key, references users.id');
  });

  it('draws one relation edge per ref column, from the column to the one it references', () => {
    render(<MarkdownDoc source={src} registry={registry} />);
    const edges = screen.getAllByTestId('erd-edge');
    expect(edges).toHaveLength(1);
    expect(edges[0]).toHaveAttribute('data-from', 'orders.user_id');
    expect(edges[0]).toHaveAttribute('data-to', 'users.id');
  });

  it('draws no wire for a ref to an undeclared table named after a prototype member', () => {
    const bad = [
      '```erd',
      'tables:',
      '  users:',
      '    columns:',
      '      id: { type: uuid, pk: true }',
      '      other_id: { type: uuid, ref: constructor.id }',
      '```',
    ].join('\n');
    render(<MarkdownDoc source={bad} registry={registry} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('other_id')).toBeInTheDocument();
    expect(screen.queryAllByTestId('erd-edge')).toHaveLength(0);
  });

  it('draws tables named after prototype members, and wires between them', () => {
    const odd = [
      '```erd',
      'tables:',
      '  constructor:',
      '    columns:',
      '      id: { type: uuid, pk: true }',
      '  toString:',
      '    columns:',
      '      parent: { type: uuid, ref: constructor.id }',
      '```',
    ].join('\n');
    render(<MarkdownDoc source={odd} registry={registry} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'constructor' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'toString' })).toBeInTheDocument();
    expect(screen.getByTestId('erd-edge')).toHaveAttribute('data-to', 'constructor.id');
  });

  it('leaves out a table named `constructor` that the schema could not check, rather than throw', () => {
    // valibot's record passes over this key without reading it, so it validates.
    const odd =
      '```erd\ntables:\n  constructor: 5\n  users:\n    columns:\n      id: { type: uuid }\n```';
    expect(validateDocument(odd, registry).errors).toEqual([]);
    render(<MarkdownDoc source={odd} registry={registry} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(readErd({ tables: { constructor: 5, users: { columns: {} } } })).toEqual({
      tables: { users: { columns: {} } },
    });
  });

  it('draws a ref to its own table as a wire', () => {
    const tree =
      '```erd\ntables:\n  categories:\n    columns:\n      id: { type: uuid, pk: true }\n      parent_id: { type: uuid, ref: categories.id }\n```';
    render(<MarkdownDoc source={tree} registry={registry} />);
    expect(screen.getByTestId('erd-edge')).toHaveAttribute('data-from', 'categories.parent_id');
  });

  it('places a referencing table to the right of the one it references', () => {
    render(<MarkdownDoc source={src} registry={registry} />);
    expect(card('users')).toHaveStyle({ left: `${ORIGIN}px`, top: `${ORIGIN}px` });
    expect(card('orders')).toHaveStyle({ left: `${ORIGIN + COLUMN_WIDTH}px` });
  });

  it('rejects a body whose column type is missing', () => {
    const bad = '```erd\ntables:\n  users:\n    columns:\n      id: {}\n```';
    const { errors } = validateDocument(bad, registry);
    expect(errors[0]).toMatchObject({ block: 'erd', path: 'tables.users.columns.id.type' });
  });

  it('rejects the old view-state fields', () => {
    for (const line of ['zoom: 0.8', 'id: core']) {
      const bad = src.replace('title: Core schema', `${line}\ntitle: Core schema`);
      expect(validateDocument(bad, registry).errors[0]).toMatchObject({ block: 'erd' });
    }
    const at = src.replace('  users:\n', '  users:\n    at: [1, 2]\n');
    const [error] = validateDocument(at, registry).errors;
    expect(error).toMatchObject({ block: 'erd', path: 'tables.users.at' });
    expect(error?.message).toMatch(/"at"/);
  });

  it('places a table where the host kept it', () => {
    const { ctx } = host({ 'Core schema': { users: [500, 600] } });
    render(<MarkdownDoc source={src} registry={registry} ctx={ctx} />);
    expect(card('users')).toHaveStyle({ left: '500px', top: '600px' });
  });

  it('places a table the host layout has no entry for, and ignores what is not a position', () => {
    const { ctx } = host({ 'Core schema': { users: [500, 600], orders: 'left' as never } });
    render(<MarkdownDoc source={src} registry={registry} ctx={ctx} />);
    expect(card('orders')).toHaveStyle({ left: `${ORIGIN + COLUMN_WIDTH}px` });
  });

  it('places a table added by a later re-render of the same instance', () => {
    // A stale positions map would throw on the new table, and the boundary
    // would remount it before this assertion runs, so the console.error spy
    // is what observes the throw. Do not reduce this to the getByTestId check.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(<MarkdownDoc source={src} registry={registry} />);
    const grown = src.replace(
      '      user_id: { type: uuid, ref: users.id }',
      '      user_id: { type: uuid, ref: users.id }\n  invoices:\n    columns:\n      id: { type: uuid, pk: true }',
    );
    rerender(<MarkdownDoc source={grown} registry={registry} />);
    expect(card('invoices')).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('moves a card with the pointer and reports every position to the host once', () => {
    const { ctx, seen } = host();
    render(<MarkdownDoc source={src} registry={registry} ctx={ctx} />);
    fireEvent.pointerDown(screen.getByText('users'), { clientX: 0, clientY: 0 });
    expect(card('users')).toHaveAttribute('data-dragging', 'true');
    fireEvent.pointerMove(handle('users'), { clientX: 10, clientY: 5 });
    expect(card('users')).toHaveStyle({ left: `${ORIGIN + 10}px`, top: `${ORIGIN + 5}px` });
    fireEvent.pointerUp(handle('users'), { clientX: 10, clientY: 5 });

    expect(card('users')).not.toHaveAttribute('data-dragging');
    expect(seen).toEqual([
      [
        'Core schema',
        { users: [ORIGIN + 10, ORIGIN + 5], orders: [ORIGIN + COLUMN_WIDTH, ORIGIN] },
      ],
    ]);
  });

  it('draws the dragged card’s wires active, and only while it is dragged', () => {
    render(<MarkdownDoc source={src} registry={registry} />);
    const edge = screen.getByTestId('erd-edge');
    fireEvent.pointerDown(screen.getByText('orders'), { clientX: 0, clientY: 0 });
    expect(edge).toHaveAttribute('data-active', 'true');
    fireEvent.pointerUp(handle('orders'), { clientX: 0, clientY: 0 });
    expect(edge).not.toHaveAttribute('data-active');
  });

  it('reports nothing for a press that does not move', () => {
    const { ctx, seen } = host();
    render(<MarkdownDoc source={src} registry={registry} ctx={ctx} />);
    dragBy('users', 0, 0);
    expect(seen).toEqual([]);
  });

  it('stops a card at the canvas’s top and left edges', () => {
    const { ctx, seen } = host();
    render(<MarkdownDoc source={src} registry={registry} ctx={ctx} />);
    dragBy('users', -100, -100);
    expect(seen[0]?.[1].users).toEqual([0, 0]);
  });

  it('converts a drag to model space at a non-default zoom', () => {
    const { ctx, seen } = host();
    render(<MarkdownDoc source={src} registry={registry} ctx={ctx} />);
    fireEvent.click(screen.getByLabelText('Zoom out')); // 1 → 0.9
    fireEvent.click(screen.getByLabelText('Zoom out')); // → 0.8
    dragBy('users', 10, 5);
    // A 10px screen drag at 0.8 scale is a 12.5-unit move in model space.
    expect(seen[0]?.[1].users).toEqual([ORIGIN + 12.5, ORIGIN + 6.25]);
  });

  it('moves a focused card with the arrow keys, further with Shift', () => {
    const { ctx, seen } = host();
    render(<MarkdownDoc source={src} registry={registry} ctx={ctx} />);
    const users = handle('users');
    expect(users).toHaveAccessibleDescription(/arrow keys/);
    fireEvent.keyDown(users, { key: 'ArrowRight' });
    fireEvent.keyDown(users, { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(users, { key: 'Enter' });
    expect(seen.map(([, layout]) => layout.users)).toEqual([
      [ORIGIN + 8, ORIGIN],
      [ORIGIN + 8, ORIGIN + 40],
    ]);
    expect(card('users')).toHaveStyle({ left: `${ORIGIN + 8}px`, top: `${ORIGIN + 40}px` });
  });

  it('keeps a layout for a titled diagram and none for an untitled one', () => {
    const { ctx, seen } = host();
    const untitled = src.replace('title: Core schema\n', '');
    render(<MarkdownDoc source={untitled} registry={registry} ctx={ctx} />);
    dragBy('users', 10, 5);
    expect(card('users')).toHaveStyle({ left: `${ORIGIN + 10}px` });
    expect(seen).toEqual([]);
  });

  it('zooms in and out from the controls, within its limits', () => {
    render(<MarkdownDoc source={src} registry={registry} />);
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(screen.getByText('1.1×')).toBeInTheDocument();
    expect(screen.getByTestId('erd-canvas')).toHaveAttribute('data-zoom', '1.1');
    fireEvent.click(screen.getByLabelText('Zoom out'));
    fireEvent.click(screen.getByLabelText('Zoom out'));
    expect(screen.getByText('0.9×')).toBeInTheDocument();
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByLabelText('Zoom out'));
    }
    expect(screen.getByText('0.4×')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom out')).toBeDisabled();
    expect(screen.getByLabelText('Zoom in')).toBeEnabled();
  });

  it('resets zoom and layout together', () => {
    render(<MarkdownDoc source={src} registry={registry} />);
    fireEvent.click(screen.getByLabelText('Zoom in'));
    dragBy('users', 10, 5);
    fireEvent.click(screen.getByLabelText('Reset zoom and layout'));
    expect(screen.getByText('1.0×')).toBeInTheDocument();
    expect(card('users')).toHaveStyle({ left: `${ORIGIN}px`, top: `${ORIGIN}px` });
  });

  it('clears the host-stored layout on reset', () => {
    const { ctx, seen } = host({ 'Core schema': { users: [500, 600] } });
    render(<MarkdownDoc source={src} registry={registry} ctx={ctx} />);
    fireEvent.click(screen.getByLabelText('Reset zoom and layout'));
    expect(seen).toContainEqual(['Core schema', {}]);
  });

  it("reads as a table per table in a page's markdown copy", () => {
    const yaml = [
      'body:',
      '  - erd:',
      '      title: Core schema',
      '      tables:',
      '        users:',
      '          columns:',
      '            id: { type: uuid, pk: true }',
      '            email: { type: text, unique: true }',
      '        orders:',
      '          columns:',
      '            id: { type: uuid, pk: true }',
      '            user_id: { type: uuid, ref: users.id }',
      '        empty:',
      '          columns: {}',
    ].join('\n');
    expect(pageMarkdown(parsePage(yaml, registry), registry)).toBe(
      [
        '**Core schema**',
        '',
        'Table `users`:',
        '',
        '| Column | Type | Key |',
        '|---|---|---|',
        '| `id` | uuid | PK |',
        '| `email` | text | unique |',
        '',
        'Table `orders`:',
        '',
        '| Column | Type | Key |',
        '|---|---|---|',
        '| `id` | uuid | PK |',
        '| `user_id` | uuid | → `users.id` |',
        '',
        'Table `empty`:',
        '',
        'No columns.',
        '',
      ].join('\n'),
    );
  });

  it('keeps a pipe from breaking a cell in the markdown copy', () => {
    const yaml = [
      'body:',
      '  - erd:',
      '      tables:',
      '        t:',
      '          columns:',
      '            a: { type: "int|text", pk: true, ref: u.id }',
    ].join('\n');
    expect(pageMarkdown(parsePage(yaml, registry), registry)).toContain(
      '| `a` | int\\|text | PK, → `u.id` |',
    );
  });
});

describe('every erd example', () => {
  const cases = erdExamples.map((example, index) => {
    return { name: `erd #${index + 1}`, source: toExample(example).source };
  });

  it.each(cases)('$name validates', ({ source }) => {
    expect(validateDocument(source, registry)).toEqual({ errors: [], warnings: [] });
  });

  it.each(cases)('$name renders without an error card', ({ source }) => {
    render(<MarkdownDoc source={source} registry={registry} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByTestId(/^erd-table-/).length).toBeGreaterThan(0);
  });
});
