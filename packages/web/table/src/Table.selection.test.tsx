/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { Table } from './Table';
import { makeStubRender } from './render-stub';
import type { CellRef, Column } from './types';

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

const rows: Row[] = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, name: `Row ${i}` }));

const columns: Column<Row>[] = [
  { key: 'pick', header: '', select: true, width: 40, resizable: false },
  { key: 'name', header: 'Name', value: (r) => r.name },
];

function Harness(props: {
  columns?: Column<Row>[];
  selectable?: boolean;
  onSelectionSpy?: (next: Set<string>) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focused, setFocused] = useState<CellRef | null>(null);
  const selectable = props.selectable ?? true;
  return (
    <div style={{ height: 400 }}>
      <Table<Row>
        columns={props.columns ?? columns}
        rows={rows}
        state={{ sort: [], widths: {}, focused, selected }}
        onSortChange={() => {}}
        onWidthChange={() => {}}
        onFocusChange={setFocused}
        getRowId={selectable ? (r) => r.id : undefined}
        onSelectionChange={
          selectable
            ? (next) => {
                setSelected(next);
                props.onSelectionSpy?.(next);
              }
            : undefined
        }
        isLoading={false}
        render={makeStubRender<Row>()}
      />
    </div>
  );
}

const gridOf = (c: HTMLElement) => c.querySelector('[data-slot="table-scroll"]') as HTMLElement;
const rowBoxes = (c: HTMLElement) =>
  [...c.querySelectorAll('[data-slot="select-row"]')] as HTMLInputElement[];
const allBox = (c: HTMLElement) => c.querySelector('[data-slot="select-all"]') as HTMLInputElement;
const selectedRows = (c: HTMLElement) =>
  [...c.querySelectorAll('[data-slot="tr"][data-selected="true"]')].map((el) =>
    el.getAttribute('data-index'),
  );

describe('row selection — the checkbox column', () => {
  it('renders a checkbox per row and one in the header', () => {
    const { container } = render(<Harness />);
    expect(rowBoxes(container)).toHaveLength(rows.length);
    expect(allBox(container)).not.toBeNull();
  });

  // A checkbox column shows no visible label, so without a name every one of
  // them is announced as an anonymous checkbox.
  it('gives every checkbox an accessible name', () => {
    const { container } = render(<Harness />);
    expect(allBox(container)).toHaveAttribute('aria-label', 'Select all rows');
    expect(rowBoxes(container)[0]).toHaveAttribute('aria-label', 'Select row 1');
  });

  it('selects a row when its checkbox is ticked', () => {
    const onSelectionSpy = vi.fn();
    const { container } = render(<Harness onSelectionSpy={onSelectionSpy} />);
    fireEvent.click(rowBoxes(container)[2]!);
    expect(onSelectionSpy).toHaveBeenCalledWith(new Set(['r2']));
  });

  it('deselects it when ticked again', () => {
    const { container } = render(<Harness />);
    fireEvent.click(rowBoxes(container)[2]!);
    fireEvent.click(rowBoxes(container)[2]!);
    expect(selectedRows(container)).toEqual([]);
  });

  // The engine, not the render set, decides a row is selected — the treatment
  // is the adapter's, the truth is the engine's.
  it('tells the row slot it is selected', () => {
    const { container } = render(<Harness />);
    fireEvent.click(rowBoxes(container)[3]!);
    expect(selectedRows(container)).toEqual(['3']);
  });

  it('does nothing at all without getRowId and onSelectionChange', () => {
    const { container } = render(<Harness selectable={false} />);
    expect(container.querySelector('[data-slot="select-row"]')).toBeNull();
  });
});

describe('row selection — select all', () => {
  it('selects every row', () => {
    const onSelectionSpy = vi.fn();
    const { container } = render(<Harness onSelectionSpy={onSelectionSpy} />);
    fireEvent.click(allBox(container));
    expect(onSelectionSpy).toHaveBeenCalledWith(new Set(rows.map((r) => r.id)));
  });

  it('clears them all on a second click', () => {
    const { container } = render(<Harness />);
    fireEvent.click(allBox(container));
    fireEvent.click(allBox(container));
    expect(selectedRows(container)).toEqual([]);
  });

  it('reads as indeterminate while only some rows are selected', () => {
    const { container } = render(<Harness />);
    fireEvent.click(rowBoxes(container)[0]!);
    expect(allBox(container)).toHaveAttribute('data-indeterminate', 'true');
  });

  it('reads as checked once every row is', () => {
    const { container } = render(<Harness />);
    fireEvent.click(allBox(container));
    expect(allBox(container).checked).toBe(true);
    expect(allBox(container)).toHaveAttribute('data-indeterminate', 'false');
  });

  // Losing a half-finished selection to one stray click is the one outcome
  // that cannot be undone by clicking again.
  it('completes a partial selection rather than clearing it', () => {
    const { container } = render(<Harness />);
    fireEvent.click(rowBoxes(container)[0]!);
    fireEvent.click(allBox(container));
    expect(selectedRows(container)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
  });
});

describe('row selection — shift-click range', () => {
  it('selects everything between the anchor and the shift-clicked row', () => {
    const { container } = render(<Harness />);
    fireEvent.click(rowBoxes(container)[1]!);
    fireEvent.click(rowBoxes(container)[4]!, { shiftKey: true });
    expect(selectedRows(container)).toEqual(['1', '2', '3', '4']);
  });

  it('reads the same shift-clicking upwards', () => {
    const { container } = render(<Harness />);
    fireEvent.click(rowBoxes(container)[4]!);
    fireEvent.click(rowBoxes(container)[1]!, { shiftKey: true });
    expect(selectedRows(container)).toEqual(['1', '2', '3', '4']);
  });

  // A range ADDS. Toggling each row would punch holes in whatever was already
  // selected, which is not what dragging a range means.
  it('never deselects a row already in the selection', () => {
    const { container } = render(<Harness />);
    fireEvent.click(rowBoxes(container)[6]!);
    fireEvent.click(rowBoxes(container)[1]!);
    fireEvent.click(rowBoxes(container)[3]!, { shiftKey: true });
    expect(selectedRows(container)).toEqual(['1', '2', '3', '6']);
  });

  // The anchor is the last row selected WITHOUT shift, and it has to survive
  // the focus move that a click causes — reading `state.focused` at click time
  // would make every range one row long.
  it('keeps the anchor across a second shift-click', () => {
    const { container } = render(<Harness />);
    fireEvent.click(rowBoxes(container)[2]!);
    fireEvent.click(rowBoxes(container)[5]!, { shiftKey: true });
    fireEvent.click(rowBoxes(container)[3]!, { shiftKey: true });
    expect(selectedRows(container)).toEqual(['2', '3', '4', '5']);
  });
});

describe('row selection — keyboard', () => {
  it('toggles the focused row on Space', () => {
    const { container } = render(<Harness />);
    const scroll = gridOf(container);
    fireEvent.keyDown(scroll, { key: 'ArrowDown' });
    fireEvent.keyDown(scroll, { key: ' ' });
    expect(selectedRows(container)).toEqual(['1']);
  });

  it('deselects on a second Space', () => {
    const { container } = render(<Harness />);
    const scroll = gridOf(container);
    fireEvent.keyDown(scroll, { key: ' ' });
    fireEvent.keyDown(scroll, { key: ' ' });
    expect(selectedRows(container)).toEqual([]);
  });

  it('extends from the anchor on Shift+Space', () => {
    const { container } = render(<Harness />);
    const scroll = gridOf(container);
    fireEvent.keyDown(scroll, { key: ' ' });
    fireEvent.keyDown(scroll, { key: 'ArrowDown' });
    fireEvent.keyDown(scroll, { key: 'ArrowDown' });
    fireEvent.keyDown(scroll, { key: ' ', shiftKey: true });
    expect(selectedRows(container)).toEqual(['0', '1', '2']);
  });

  // Space is the browser's page-down. Swallowing it in a table that does not
  // select would take that away for nothing.
  it('leaves Space alone when the table does not select', () => {
    const { container } = render(<Harness selectable={false} />);
    const consumed = !fireEvent.keyDown(gridOf(container), { key: ' ' });
    expect(consumed).toBe(false);
  });

  it('does not select from the header row', () => {
    const { container } = render(<Harness />);
    const scroll = gridOf(container);
    fireEvent.keyDown(scroll, { key: 'ArrowUp' });
    fireEvent.keyDown(scroll, { key: ' ' });
    expect(selectedRows(container)).toEqual([]);
  });
});
