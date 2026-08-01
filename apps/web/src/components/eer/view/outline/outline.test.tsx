import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: 'Zone One, 1 table' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'users' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'orders' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tags' })).toBeInTheDocument();
  });

  it('counts the tables in a group, including nested ones', async () => {
    await renderDiagram(<Outline />, nestedRaw());
    // The zone owns one card directly and two through its subgroup.
    expect(screen.getByRole('button', { name: 'Zone, 3 tables' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sub, 2 tables' })).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'tags' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'users' })).not.toBeInTheDocument();
    // …and the group that has no match goes with it.
    expect(screen.queryByRole('button', { name: /Zone One/ })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Zone Two subtree' }));
    expect(screen.queryByRole('button', { name: 'tags' })).not.toBeInTheDocument();
    // Filtering has to win over the collapsed state, or a match lands inside a
    // closed group and the search looks like it found nothing.
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter tables' }), {
      target: { value: 'tags' },
    });
    expect(screen.getByRole('button', { name: 'tags' })).toBeInTheDocument();
  });

  it('clears the filter on Escape', async () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    const box = screen.getByRole('textbox', { name: 'Filter tables' });
    fireEvent.change(box, { target: { value: 'tags' } });
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'users' })).toBeInTheDocument();
  });

  it('collapses and expands a group', async () => {
    await renderDiagram(<Outline />, twoZoneRaw());
    const chevron = screen.getByRole('button', { name: 'Zone One subtree' });
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'users' })).not.toBeInTheDocument();
    fireEvent.click(chevron);
    expect(screen.getByRole('button', { name: 'users' })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'orders' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Zone Two, 2 tables' }));
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
    expect(screen.getByRole('button', { name: 'tags' }).className).not.toContain('line-through');
    fireEvent.click(screen.getByRole('button', { name: 'Hide Zone Two' }));
    expect(screen.getByRole('button', { name: 'tags' }).className).toContain('line-through');
    expect(screen.getByRole('button', { name: 'users' }).className).not.toContain('line-through');
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
    fireEvent.click(screen.getByRole('button', { name: 'manager_id' }));
    expect(focus).toHaveBeenCalledWith('users', 'manager_id');
  });

  it('offers the edge-kind filters and toggles one', async () => {
    await renderDiagram(
      <>
        <UiGrab />
        <Outline />
      </>,
      twoZoneRaw(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Many-to-many' }));
    expect(uiRef!.hidden.kinds.has('nm')).toBe(true);
  });

  it('omits the edge section entirely for a model that declares no kinds', async () => {
    // A schema graph declares none (schemaGraphToModel passes no `kinds`), so
    // an always-rendered heading would be a permanently empty section on the
    // only screen that uses this.
    await renderDiagram(<Outline />, nestedRaw());
    expect(screen.queryByText('Edges')).not.toBeInTheDocument();
  });

  it('nests a subgroup inside its zone rather than flattening both to one level', async () => {
    await renderDiagram(<Outline />, nestedRaw());
    const zone = screen
      .getByRole('button', { name: 'Zone, 3 tables' })
      .closest('div')!.parentElement!;
    expect(within(zone).getByRole('button', { name: 'Sub, 2 tables' })).toBeInTheDocument();
    expect(within(zone).getByRole('button', { name: 'm1' })).toBeInTheDocument();
  });

  it('draws a hidden zone with a hollow swatch, not a filled one', async () => {
    // The swatch doubles as the visibility control, so its OFF state has to be
    // unmistakable. It used to fake a ring by passing border classes through
    // className; `hollow` is the real thing.
    await renderDiagram(<Outline />, twoZoneRaw());
    // The regex form from the plan (name: /Zone Two/) matches three buttons
    // in this row — the select button, the chevron, and the toggle — so this
    // pins the select button's exact accessible name instead.
    const swatch = () => screen.getByRole('button', { name: 'Zone Two, 2 tables' })
      .closest('div')!.querySelector('span[aria-hidden]') as HTMLElement;
    expect(swatch().className).toContain('bg-(--dot-color)');
    fireEvent.click(screen.getByRole('button', { name: 'Hide Zone Two' }));
    expect(swatch().className).toContain('border-1');
    expect(swatch().className).not.toContain('bg-(--dot-color)');
  });
});
