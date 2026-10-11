/// <reference types="@testing-library/jest-dom/vitest" />
// Header filters in the engine: a column's `filter` becomes its cell in a row
// the header carries, the data rows count that row in their `aria-rowindex`,
// and Alt+↓ on a header opens the accessory a render set drew beside its label.
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import { Table } from './Table';
import { makeStubRender } from './render-stub';
import { HEADER_ACCESSORY_ATTR, type CellRef, type Column, type TableRender } from './types';

afterEach(cleanup);

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

const rows: Row[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
];

const filtered: Column<Row>[] = [
  { key: 'name', header: 'Name', value: (r) => r.name, filter: <input aria-label="Name filter" /> },
  { key: 'id', header: 'Id', value: (r) => r.id, pinned: 'left', width: 80 },
];

const plain: Column<Row>[] = [
  //
  { key: 'name', header: 'Name', value: (r) => r.name },
  { key: 'id', header: 'Id', value: (r) => r.id },
];

function Harness(props: Partial<ComponentProps<typeof Table<Row>>>) {
  return (
    <div style={{ height: 400 }}>
      <Table<Row>
        columns={filtered}
        rows={rows}
        state={{ sort: [], widths: {} }}
        onSortChange={() => {}}
        onWidthChange={() => {}}
        isLoading={false}
        render={makeStubRender<Row>()}
        {...props}
      />
    </div>
  );
}

describe('<Table> engine — filter row', () => {
  it('draws no filter row when no column has a filter', () => {
    const { container } = render(<Harness columns={plain} />);
    expect(container.querySelector('[data-slot="filter-row"]')).toBeNull();
  });

  it('puts one cell per column in a row the header carries', () => {
    const { container, getByLabelText } = render(<Harness />);
    const row = container.querySelector('[data-slot="thead"] [data-slot="filter-row"]');
    expect(row).not.toBeNull();
    const keys = [...container.querySelectorAll('[data-slot="filter-cell"]')].map((cell) => {
      return cell.getAttribute('data-key');
    });
    expect(keys).toEqual(['name', 'id']);
    expect(getByLabelText('Name filter')).toBeInTheDocument();
  });

  it('holds a frozen column filter still, like the rest of that column', () => {
    const { container } = render(<Harness />);
    const cell = container.querySelector('[data-slot="filter-cell"][data-key="id"]');
    expect(cell?.getAttribute('data-pin')).toBe('left:0:edge');
  });

  it('draws nothing for a render set without the slot', () => {
    const { filterRow: _omitted, ...withoutSlot } = makeStubRender<Row>();
    const { container } = render(<Harness render={withoutSlot} />);
    expect(container.querySelector('[data-slot="filter-row"]')).toBeNull();
  });

  it('counts the filter row among the rows above the data', () => {
    const { container } = render(<Harness />);
    const grid = container.querySelector('[data-slot="root"]');
    const indices = [...container.querySelectorAll('[data-slot="tr"]')].map((tr) => {
      return tr.getAttribute('aria-rowindex');
    });
    // Header 1, filter row 2, data from 3.
    expect(indices).toEqual(['3', '4']);
    expect(grid?.getAttribute('aria-rowcount')).toBe('4');
  });

  it('starts the data at row 2 without one', () => {
    const { container } = render(<Harness columns={plain} />);
    expect(container.querySelector('[data-slot="tr"]')?.getAttribute('aria-rowindex')).toBe('2');
  });

  it('tells the pinned group band it sits under the filter row', () => {
    const { container } = render(
      <Harness stickyGroupHeader groups={[{ key: 'g', header: 'Group', rows }]} rows={[]} />,
    );
    const band = container.querySelector('[data-slot="sticky-group-header"]');
    expect(band?.getAttribute('data-below-filter-row')).toBe('true');
  });
});

/** A header cell the way a real render set draws one: a cell holding a sort
 *  button and, after it, the accessory in its marked wrapper. */
function withAccessoryHeader(): TableRender<Row> {
  const base = makeStubRender<Row>();
  return {
    ...base,
    th: ({ column, focusProps, onSortClick }) => {
      return (
        <div {...focusProps} data-slot="th" data-key={column.key}>
          <button type="button" onClick={onSortClick}>
            {column.header}
          </button>
          {column.headerAccessory ? (
            <span {...{ [HEADER_ACCESSORY_ATTR]: '' }}>{column.headerAccessory}</span>
          ) : null}
        </div>
      );
    },
  };
}

function FocusHarness({ columns, onSort }: { columns: Column<Row>[]; onSort: () => void }) {
  const [focused, setFocused] = useState<CellRef | null>({ rowIndex: -1, columnKey: 'name' });
  return (
    <div style={{ height: 400 }}>
      <Table<Row>
        columns={columns}
        rows={rows}
        state={{ sort: [], widths: {}, focused }}
        onSortChange={onSort}
        onWidthChange={() => {}}
        onFocusChange={setFocused}
        isLoading={false}
        render={withAccessoryHeader()}
      />
    </div>
  );
}

describe('<Table> engine — header accessory', () => {
  const gridOf = (c: HTMLElement) => c.querySelector('[data-slot="table-scroll"]') as HTMLElement;

  it('opens the accessory on Alt+↓ and does not sort', () => {
    const onOpen = vi.fn();
    const onSort = vi.fn();
    const columns: Column<Row>[] = [
      {
        key: 'name',
        header: 'Name',
        value: (r) => r.name,
        sortable: true,
        headerAccessory: (
          <button type="button" onClick={onOpen}>
            filter
          </button>
        ),
      },
    ];
    const { container } = render(<FocusHarness columns={columns} onSort={onSort} />);
    const consumed = !fireEvent.keyDown(gridOf(container), { key: 'ArrowDown', altKey: true });
    expect(consumed).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onSort).not.toHaveBeenCalled();
  });

  it('still sorts on Enter, which reaches the sort control before the accessory', () => {
    const onOpen = vi.fn();
    const onSort = vi.fn();
    const columns: Column<Row>[] = [
      {
        key: 'name',
        header: 'Name',
        value: (r) => r.name,
        sortable: true,
        headerAccessory: (
          <button type="button" onClick={onOpen}>
            filter
          </button>
        ),
      },
    ];
    const { container } = render(<FocusHarness columns={columns} onSort={onSort} />);
    fireEvent.keyDown(gridOf(container), { key: 'Enter' });
    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('leaves Alt+↓ to ordinary navigation on a header without one', () => {
    const { container } = render(<FocusHarness columns={plain} onSort={() => {}} />);
    fireEvent.keyDown(gridOf(container), { key: 'ArrowDown', altKey: true });
    const focused = container.querySelector('[tabindex="0"]');
    expect(focused?.getAttribute('data-cell-row')).toBe('0');
  });
});
