/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { fireEvent, render, act } from '@testing-library/react';
import { useState } from 'react';
import { Table } from './Table';
import { makeStubRender } from './render-stub';
import type { CellRef, Column, SortBy, TableRender } from './types';

let _originalResizeObserver: typeof ResizeObserver;
beforeAll(() => {
  _originalResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class MockResizeObserver {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      this.cb(
        [
          {
            target,
            contentRect: { width: 1000, height: 400 } as DOMRectReadOnly,
            borderBoxSize: [{ inlineSize: 1000, blockSize: 400 }] as ResizeObserverSize[],
            contentBoxSize: [{ inlineSize: 1000, blockSize: 400 }] as ResizeObserverSize[],
            devicePixelContentBoxSize: [] as ResizeObserverSize[],
          },
        ],
        this,
      );
    }
    unobserve() {}
    disconnect() {}
  };
});
afterAll(() => {
  globalThis.ResizeObserver = _originalResizeObserver;
});

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = Array.from({ length: 30 }, (_, i) => ({
  id: String(i),
  name: `Row ${i}`,
}));

const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', value: (r) => r.name, sortable: true },
  { key: 'id', header: 'Id', value: (r) => r.id },
];

/** A cell whose content is a real widget, which is the whole reason
 *  interaction mode exists. */
const withWidget: Column<Row>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (r) => <button type="button">edit {r.name}</button>,
  },
  { key: 'id', header: 'Id', value: (r) => r.id },
];

/** Uncontrolled harness: the engine drives `focused` through `onFocusChange`
 *  exactly as `useTable()` would, so these tests exercise the real loop
 *  rather than a frozen state. */
function Harness(props: {
  columns?: Column<Row>[];
  rows?: Row[];
  focusable?: boolean;
  sort?: SortBy[];
  onSortChange?: (next: SortBy[]) => void;
  onRowActivate?: (row: Row) => void;
  render?: TableRender<Row>;
  onFocusRef?: (ref: CellRef | null) => void;
}) {
  const [focused, setFocused] = useState<CellRef | null>(null);
  const focusable = props.focusable ?? true;
  return (
    <div style={{ height: 400 }}>
      <Table<Row>
        columns={props.columns ?? columns}
        rows={props.rows ?? rows}
        state={{ sort: props.sort ?? [], widths: {}, focused }}
        onSortChange={props.onSortChange ?? (() => {})}
        onWidthChange={() => {}}
        onFocusChange={
          focusable
            ? (next) => {
                setFocused(next);
                props.onFocusRef?.(next);
              }
            : undefined
        }
        onRowActivate={props.onRowActivate}
        isLoading={false}
        render={props.render ?? makeStubRender<Row>()}
      />
    </div>
  );
}

const gridOf = (c: HTMLElement) => c.querySelector('[data-slot="table-scroll"]') as HTMLElement;
const cellAt = (c: HTMLElement, row: number, col: string) =>
  [...c.querySelectorAll(`[data-cell-row="${row}"]`)].find(
    (el) => el.getAttribute('data-cell-col') === col,
  ) as HTMLElement | undefined;
const focusedCell = (c: HTMLElement) =>
  c.querySelector('[data-focused="true"]') as HTMLElement | null;
const coordsOf = (el: Element | null) =>
  el && [el.getAttribute('data-cell-row'), el.getAttribute('data-cell-col')];

describe('cell focus — the roving tab stop', () => {
  // The ARIA grid contract: exactly one cell is tabbable, so Tab enters the
  // grid once and the next Tab leaves it. A grid where every cell is a tab
  // stop is a keyboard trap; one where every cell is -1 cannot be entered.
  it('makes exactly one cell tabbable', () => {
    const { container } = render(<Harness />);
    const tabbable = container.querySelectorAll('[data-cell-row][tabindex="0"]');
    expect(tabbable).toHaveLength(1);
  });

  it('starts that tab stop on the first data cell', () => {
    const { container } = render(<Harness />);
    const tabbable = container.querySelector('[data-cell-row][tabindex="0"]');
    expect(coordsOf(tabbable)).toEqual(['0', 'name']);
  });

  it('draws no ring before the user has focused anything', () => {
    const { container } = render(<Harness />);
    expect(focusedCell(container)).toBeNull();
  });

  it('moves the tab stop with the focus', () => {
    const { container } = render(<Harness />);
    fireEvent.keyDown(gridOf(container), { key: 'ArrowRight' });
    const tabbable = container.querySelectorAll('[data-cell-row][tabindex="0"]');
    expect(tabbable).toHaveLength(1);
    expect(coordsOf(tabbable[0]!)).toEqual(['0', 'id']);
  });

  // Everything else has to be -1, or Tab walks 30 rows before it leaves.
  it('leaves every other cell out of the tab order', () => {
    const { container } = render(<Harness />);
    const cells = [...container.querySelectorAll('[data-cell-row]')];
    const stops = cells.filter((el) => el.getAttribute('tabindex') !== '-1');
    expect(stops).toHaveLength(1);
  });

  // Turning the roving tabindex on unasked would make every link and button
  // inside a table unreachable by Tab, so it stays off without onFocusChange.
  it('does not touch the tab order when the caller has not opted in', () => {
    const { container } = render(<Harness focusable={false} />);
    expect(container.querySelector('[data-cell-row][tabindex]')).toBeNull();
  });
});

describe('cell focus — keyboard navigation', () => {
  it('moves the ring right with ArrowRight', () => {
    const { container } = render(<Harness />);
    fireEvent.keyDown(gridOf(container), { key: 'ArrowRight' });
    expect(coordsOf(focusedCell(container))).toEqual(['0', 'id']);
  });

  it('moves the ring down with ArrowDown', () => {
    const { container } = render(<Harness />);
    fireEvent.keyDown(gridOf(container), { key: 'ArrowDown' });
    expect(coordsOf(focusedCell(container))).toEqual(['1', 'name']);
  });

  // The header row is `rowIndex: -1`, and reaching it is the only way to sort
  // without a mouse.
  it('reaches the header row from row 0', () => {
    const { container } = render(<Harness />);
    fireEvent.keyDown(gridOf(container), { key: 'ArrowUp' });
    expect(coordsOf(focusedCell(container))).toEqual(['-1', 'name']);
  });

  it('gives the focused cell real DOM focus', () => {
    const { container } = render(<Harness />);
    fireEvent.keyDown(gridOf(container), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cellAt(container, 1, 'name'));
  });

  it('jumps to the last cell in the table on Ctrl+End', () => {
    const onFocusRef = vi.fn();
    const { container } = render(<Harness onFocusRef={onFocusRef} />);
    fireEvent.keyDown(gridOf(container), { key: 'End', ctrlKey: true });
    expect(onFocusRef).toHaveBeenCalledWith({ rowIndex: 29, columnKey: 'id' });
  });

  // Tab must fall through to the browser. If the engine swallowed it, the
  // grid would be inescapable.
  it('does not consume Tab', () => {
    const { container } = render(<Harness />);
    const consumed = !fireEvent.keyDown(gridOf(container), { key: 'Tab' });
    expect(consumed).toBe(false);
  });

  it('consumes the arrow keys so the container does not also scroll', () => {
    const { container } = render(<Harness />);
    const consumed = !fireEvent.keyDown(gridOf(container), { key: 'ArrowDown' });
    expect(consumed).toBe(true);
  });
});

describe('cell focus — virtualization', () => {
  // Row 29 of 30 is far outside the mounted window. Focusing it must scroll
  // first and focus second, or the focus call lands on a node that does not
  // exist yet and DOM focus falls to <body>.
  it('scrolls a far-off row into view before focusing it', () => {
    const { container } = render(<Harness />);
    const scroll = gridOf(container);
    const scrollTo = vi.fn();
    scroll.scrollTo = scrollTo as unknown as typeof scroll.scrollTo;
    Object.defineProperty(scroll, 'scrollHeight', { value: 30 * 40, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 400, configurable: true });

    fireEvent.keyDown(scroll, { key: 'End', ctrlKey: true });
    expect(scrollTo).toHaveBeenCalled();
  });

  // The mitigation for the one thing roving tabindex cannot do: when a mouse
  // scroll unmounts the focused row, DOM focus must not fall to <body>. It is
  // parked on the scroll container and the logical CellRef is kept.
  it('parks focus on the scroll container when the focused row unmounts', () => {
    const { container, rerender } = render(<Harness />);
    const scroll = gridOf(container);
    fireEvent.keyDown(scroll, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cellAt(container, 1, 'name'));

    // Re-render with the focused row gone, which is what virtualizing it away
    // amounts to as far as the DOM is concerned.
    act(() => {
      rerender(<Harness rows={[]} />);
    });
    expect(document.activeElement).toBe(scroll);
  });
});

describe('cell focus — the two modes', () => {
  it("steps into the cell's widget on Enter", () => {
    const { container } = render(<Harness columns={withWidget} />);
    fireEvent.keyDown(gridOf(container), { key: 'Enter' });
    expect(document.activeElement?.textContent).toBe('edit Row 0');
  });

  it('steps in on F2 as well', () => {
    const { container } = render(<Harness columns={withWidget} />);
    fireEvent.keyDown(gridOf(container), { key: 'F2' });
    expect(document.activeElement?.textContent).toBe('edit Row 0');
  });

  it('comes back out to the cell on Escape', () => {
    const { container } = render(<Harness columns={withWidget} />);
    const scroll = gridOf(container);
    fireEvent.keyDown(scroll, { key: 'Enter' });
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(document.activeElement).toBe(cellAt(container, 0, 'name'));
  });

  // Arrows belong to the widget while inside it — a dropdown's up/down must
  // not also move the grid's focus.
  it('leaves the arrows to the widget while inside it', () => {
    const { container } = render(<Harness columns={withWidget} />);
    const scroll = gridOf(container);
    fireEvent.keyDown(scroll, { key: 'Enter' });
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(coordsOf(focusedCell(container))).toEqual(['0', 'name']);
  });

  // A cell with no widget of its own has nothing to step into, so Enter is
  // the row's activation instead.
  it('activates the row when the cell holds no widget', () => {
    const onRowActivate = vi.fn();
    const { container } = render(<Harness onRowActivate={onRowActivate} />);
    fireEvent.keyDown(gridOf(container), { key: 'Enter' });
    expect(onRowActivate).toHaveBeenCalledWith(rows[0]);
  });

  it('does not activate the row when the cell does hold a widget', () => {
    const onRowActivate = vi.fn();
    const { container } = render(<Harness columns={withWidget} onRowActivate={onRowActivate} />);
    fireEvent.keyDown(gridOf(container), { key: 'Enter' });
    expect(onRowActivate).not.toHaveBeenCalled();
  });
});

describe('cell focus — one tab stop, including widgets', () => {
  // Roving tabindex on the CELLS is only half the job. Ten columns of buttons
  // over a thousand rows is still a keyboard trap if the buttons stay
  // tabbable, so navigation mode pushes them out of the tab order too.
  it('takes cell widgets out of the tab order in navigation mode', () => {
    const { container } = render(<Harness columns={withWidget} />);
    const buttons = [...container.querySelectorAll('[data-cell-row] button')];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => b.getAttribute('tabindex') === '-1')).toBe(true);
  });

  // And gives them back, or interaction mode could not walk a cell holding
  // three action buttons.
  it("gives the entered cell's widgets their tab order back", () => {
    const { container } = render(<Harness columns={withWidget} />);
    fireEvent.keyDown(gridOf(container), { key: 'Enter' });
    const inside = cellAt(container, 0, 'name')?.querySelector('button');
    expect(inside).not.toHaveAttribute('tabindex');
  });

  it('takes them away again on Escape', () => {
    const { container } = render(<Harness columns={withWidget} />);
    const scroll = gridOf(container);
    fireEvent.keyDown(scroll, { key: 'Enter' });
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(cellAt(container, 0, 'name')?.querySelector('button')).toHaveAttribute('tabindex', '-1');
  });
});

describe('cell focus — sorting from the keyboard', () => {
  // The header row is addressable precisely so sorting is keyboard-reachable.
  // Two keystrokes (step in, then activate) would not be that.
  it('sorts with a single Enter on a header cell', () => {
    const onSortChange = vi.fn();
    const { container } = render(<Harness onSortChange={onSortChange} />);
    const scroll = gridOf(container);
    fireEvent.keyDown(scroll, { key: 'ArrowUp' });
    fireEvent.keyDown(scroll, { key: 'Enter' });
    expect(onSortChange).toHaveBeenCalledWith([{ field: 'name', direction: 'asc' }]);
  });

  // Shift+Enter has to reach the header's click handler as a genuinely
  // SHIFTED click, or multi-sort stays mouse-only. Starting from a sort on
  // another column is what makes the two paths distinguishable: a plain
  // Enter would replace it, a shifted one appends.
  it('adds a second sort key on Shift+Enter', () => {
    const onSortChange = vi.fn();
    const { container } = render(
      <Harness sort={[{ field: 'id', direction: 'asc' }]} onSortChange={onSortChange} />,
    );
    const scroll = gridOf(container);
    fireEvent.keyDown(scroll, { key: 'ArrowUp' });
    fireEvent.keyDown(scroll, { key: 'Enter', shiftKey: true });
    expect(onSortChange).toHaveBeenCalledWith([
      { field: 'id', direction: 'asc' },
      { field: 'name', direction: 'asc' },
    ]);
  });

  it('replaces the sort on a plain Enter', () => {
    const onSortChange = vi.fn();
    const { container } = render(
      <Harness sort={[{ field: 'id', direction: 'asc' }]} onSortChange={onSortChange} />,
    );
    const scroll = gridOf(container);
    fireEvent.keyDown(scroll, { key: 'ArrowUp' });
    fireEvent.keyDown(scroll, { key: 'Enter' });
    expect(onSortChange).toHaveBeenCalledWith([{ field: 'name', direction: 'asc' }]);
  });
});

describe('cell focus — mouse', () => {
  it('adopts the cell the user focused with a click', () => {
    const { container } = render(<Harness />);
    const cell = cellAt(container, 2, 'id') as HTMLElement;
    fireEvent.focus(cell, { target: cell });
    expect(coordsOf(focusedCell(container))).toEqual(['2', 'id']);
  });
});

describe('cell focus — copy', () => {
  it("copies the focused cell's text on Ctrl+C", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { container } = render(<Harness />);
    fireEvent.keyDown(gridOf(container), { key: 'ArrowDown' });
    fireEvent.keyDown(gridOf(container), { key: 'c', ctrlKey: true });
    expect(writeText).toHaveBeenCalledWith('Row 1');
  });
});
