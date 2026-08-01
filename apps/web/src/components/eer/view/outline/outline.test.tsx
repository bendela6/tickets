import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDiagramUi } from '../../state/diagram-context';
import type { DiagramUi } from '../../state/diagram-reducer';
import { nestedRaw, twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { Outline } from './outline';

afterEach(cleanup);

let uiRef: DiagramUi | null = null;
function UiGrab() {
  uiRef = useDiagramUi();
  return null;
}

describe('Outline', () => {
  // Load-bearing: SchemaPanel renders this into the app shell's mode panel, and
  // that panel also mounts on routes with no diagram at all. Throwing there (as
  // the strict useDiagram* hooks do by design) would take down the whole shell.
  it('renders nothing when there is no diagram provider above it', () => {
    const { container } = render(<Outline />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each group with the tables inside it', async () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    expect(screen.getByRole('treeitem', { name: 'Zone One, 1 table' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'users' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'orders' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'tags' })).toBeInTheDocument();
  });

  it('counts the tables in a group, including nested ones', async () => {
    await renderDiagram(<Outline />, nestedRaw());
    // The zone owns one card directly and two through its subgroup.
    expect(screen.getByRole('treeitem', { name: 'Zone, 3 tables' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'Sub, 2 tables' })).toBeInTheDocument();
  });

  it('states the model size', async () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    expect(screen.getByText('3 tables · 3 relationships')).toBeInTheDocument();
  });

  it('filters the tree to matches as you type', async () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter tables' }), {
      target: { value: 'tags' },
    });
    expect(screen.getByRole('treeitem', { name: 'tags' })).toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: 'users' })).not.toBeInTheDocument();
    // …and the group that has no match goes with it.
    expect(screen.queryByRole('treeitem', { name: /Zone One/ })).not.toBeInTheDocument();
  });

  it('says so when nothing matches, rather than showing an empty pane', async () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter tables' }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('No tables match.')).toBeInTheDocument();
  });

  it('reopens a collapsed group when a query matches inside it', async () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    // Every group starts OPEN, so the first click on Zone Two's caret collapses it.
    fireEvent.click(screen.getByRole('button', { name: 'collapse Zone Two' }));
    expect(screen.queryByRole('treeitem', { name: 'tags' })).not.toBeInTheDocument();
    // Filtering has to win over the collapsed state, or a match lands inside a
    // closed group and the search looks like it found nothing.
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter tables' }), {
      target: { value: 'tags' },
    });
    expect(screen.getByRole('treeitem', { name: 'tags' })).toBeInTheDocument();
  });

  it('clears the filter on Escape', async () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    const box = screen.getByRole('textbox', { name: 'Filter tables' });
    fireEvent.change(box, { target: { value: 'tags' } });
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.getByRole('treeitem', { name: 'users' })).toBeInTheDocument();
  });

  it('collapses and expands a group', async () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    // Every group starts open: `defaultExpanded` on useTreeView, not a
    // mount-time loop of `toggle()` calls.
    const row = screen.getByRole('treeitem', { name: 'Zone One, 1 table' });
    expect(row).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'collapse Zone One' }));
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('treeitem', { name: 'users' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'expand Zone One' }));
    expect(screen.getByRole('treeitem', { name: 'users' })).toBeInTheDocument();
  });

  it('clicking a table selects it and pans the canvas to it', async () => {
    // Both halves matter: selecting alone leaves you hunting for the card, and
    // panning alone leaves the detail panel showing something else.
    const { actions } = await renderDiagram(
      <>
        <UiGrab />
        <Outline />
      </>,
      twoZoneRaw(),
    );
    const focus = vi.spyOn(actions, 'focusFromSearch');
    fireEvent.click(screen.getByRole('treeitem', { name: 'orders' }));
    expect(focus).toHaveBeenCalledWith('orders');
    expect(uiRef!.panelSelection).toEqual({ type: 'entity', id: 'orders' });
  });

  it('clicking a group selects it', async () => {
    await renderDiagram(
      <>
        <UiGrab />
        <Outline />
      </>,
      twoZoneRaw(),
    );
    fireEvent.click(screen.getByRole('treeitem', { name: 'Zone Two, 2 tables' }));
    expect(uiRef!.panelSelection).toEqual({ type: 'group', id: 'z2' });
  });

  it('the group swatch toggles that group hidden', async () => {
    await renderDiagram(
      <>
        <UiGrab />
        <Outline />
      </>,
      twoZoneRaw(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hide Zone Two' }));
    expect(uiRef!.hidden.groups.has('z2')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Show Zone Two' }));
    expect(uiRef!.hidden.groups.has('z2')).toBe(false);
  });

  it('strikes through the tables of a hidden group', async () => {
    // Otherwise clicking one looks broken: it selects fine, but the canvas has
    // no card to pan to, so nothing appears to happen.
    await renderDiagram(<Outline />, twoZoneRaw());
    expect(screen.getByRole('treeitem', { name: 'tags' }).className).not.toContain('line-through');
    fireEvent.click(screen.getByRole('button', { name: 'Hide Zone Two' }));
    expect(screen.getByRole('treeitem', { name: 'tags' }).className).toContain('line-through');
    expect(screen.getByRole('treeitem', { name: 'users' }).className).not.toContain('line-through');
  });

  it('gives a SUBGROUP no visibility toggle of its own', async () => {
    // hiddenIds() resolves every entity through zoneIdOf, so a subgroup id in
    // the hidden set is an entry nothing ever reads — a toggle here would look
    // like a control and do nothing.
    await renderDiagram(<Outline />, nestedRaw());
    expect(screen.getByRole('button', { name: 'Hide Zone' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide Sub' })).not.toBeInTheDocument();
  });

  it('surfaces a table by column, and jumps to the field when the column is clicked', async () => {
    const { actions } = await renderDiagram(<Outline />, twoZoneRaw());
    const focus = vi.spyOn(actions, 'focusFromSearch');
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter tables' }), {
      target: { value: 'manager' },
    });
    fireEvent.click(screen.getByRole('treeitem', { name: 'manager_id' }));
    expect(focus).toHaveBeenCalledWith('users', 'manager_id');
  });

  it('highlights a searched-to column with a background, not text colour alone', async () => {
    // A lit column used to pair a background with the lightened text
    // (`bg-surface-inset text-gray-12`); dropping the background during the
    // tree migration would leave the "this is the field you searched for"
    // callout reading as a faint hover instead of a real highlight.
    await renderDiagram(<Outline />, twoZoneRaw());
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter tables' }), {
      target: { value: 'manager' },
    });
    // Split, not a raw substring check: `TreeRow`'s own base classes always
    // include `hover:bg-surface-inset`, which itself contains the substring
    // "bg-surface-inset" whether or not the column is lit.
    const classList = () =>
      screen.getByRole('treeitem', { name: 'manager_id' }).className.split(/\s+/);
    expect(classList()).not.toContain('bg-surface-inset');
    fireEvent.click(screen.getByRole('treeitem', { name: 'manager_id' }));
    expect(classList()).toContain('bg-surface-inset');
    expect(classList()).toContain('text-gray-12');
  });

  it('offers the edge-kind filters as Pills and toggles one', async () => {
    await renderDiagram(
      <>
        <UiGrab />
        <Outline />
      </>,
      twoZoneRaw(),
    );
    const nm = screen.getByRole('button', { name: 'Many-to-many' });
    // Pill wires `pressed` to aria-pressed, which the hand-rolled chip never did —
    // the ON/OFF state was previously visual only.
    expect(nm).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(nm);
    expect(uiRef!.hidden.kinds.has('nm')).toBe(true);
    expect(screen.getByRole('button', { name: 'Many-to-many' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('omits the edge section entirely for a model that declares no kinds', async () => {
    // A schema graph declares none (schemaGraphToModel passes no `kinds`), so
    // an always-rendered heading would be a permanently empty section on the
    // only screen that uses this.
    await renderDiagram(<Outline />, nestedRaw());
    expect(screen.queryByText('Edges')).not.toBeInTheDocument();
  });

  it('renders a subgroup deeper than its zone, using guide columns rather than a nested container', async () => {
    // The recursive nesting container is gone — indentation is TreeRow's
    // per-row guide columns, one per depth level. Pinned to EXACT counts, not
    // just "more than its parent": Zone is a root (depth 0, no guides), Sub
    // nests one level under it (depth 1), and Sub's own table nests one level
    // further still (depth 2) — the same three-level shape the old recursive
    // container nesting asserted, expressed through the new mechanism.
    await renderDiagram(<Outline />, nestedRaw());
    const zoneRow = screen.getByRole('treeitem', { name: 'Zone, 3 tables' });
    const subRow = screen.getByRole('treeitem', { name: 'Sub, 2 tables' });
    const memberRow = screen.getByRole('treeitem', { name: 'm1' });
    const guidesFor = (row: HTMLElement) =>
      row.closest('div')!.querySelectorAll('[data-tree-guide]').length;
    expect(guidesFor(zoneRow)).toBe(0);
    expect(guidesFor(subRow)).toBe(1);
    expect(guidesFor(memberRow)).toBe(2);
  });

  it('draws a hidden zone with a hollow swatch, not a filled one', async () => {
    // The swatch doubles as the visibility control, so its OFF state has to be
    // unmistakable. It used to fake a ring by passing ring-styling classes
    // through className; `hollow` is the real thing.
    await renderDiagram(<Outline />, twoZoneRaw());
    // The regex form from the plan (name: /Zone Two/) matches more than one
    // element in this row — the caret, the toggle, and the treeitem — so this
    // pins the treeitem's exact accessible name instead.
    const swatch = () => screen.getByRole('treeitem', { name: 'Zone Two, 2 tables' })
      .closest('div')!.querySelector('span[aria-hidden]') as HTMLElement;
    expect(swatch().className).toContain('bg-(--dot-color)');
    fireEvent.click(screen.getByRole('button', { name: 'Hide Zone Two' }));
    expect(swatch().className).toContain('border-1');
    expect(swatch().className).not.toContain('bg-(--dot-color)');
  });

  it('draws the disclosure caret as an icon, not a text glyph', async () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    // Every group starts open, so the caret's accessible name is "collapse …".
    const caret = screen.getByRole('button', { name: 'collapse Zone One' });
    expect(caret.querySelector('svg')).not.toBeNull();
    expect(caret.textContent).toBe('');
  });

  it('is a keyboard-navigable tree', async () => {
    // The outline had NO keyboard support before it moved onto the shared tree.
    await renderDiagram(<Outline />, twoZoneRaw());
    const tree = screen.getByRole('tree');
    expect(tree).toHaveAttribute('tabindex', '0');
    // Focus seeds to the first root (Zone One); every group starts expanded,
    // so its own table (`users`) is the very next flattened row — the
    // strict target, not just "moved somewhere".
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(tree.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('treeitem', { name: 'users' }).id,
    );
    // 'users' renders no column rows while unfiltered — buildOutline only
    // attaches columns on a query match — so it is a genuine LEAF: exactly
    // the shape that used to compute `expanded: true` from the outline's
    // `defaultExpanded` baseline alone, with ArrowLeft then toggling the
    // leaf instead of walking to its parent group.
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(tree.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('treeitem', { name: 'Zone One, 1 table' }).id,
    );
    fireEvent.keyDown(tree, { key: 'End' });
    // Home/End land on the last navigable row — the last column, table or
    // group in the flattened, fully-expanded tree.
    expect(screen.getByRole('treeitem', { name: 'tags' }).id).toBe(tree.getAttribute('aria-activedescendant'));
  });

  it('keeps the group rows as treeitems', async () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    expect(screen.getAllByRole('treeitem').length).toBeGreaterThan(0);
  });
});
