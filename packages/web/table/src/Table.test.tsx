/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { Table } from './Table';
import { makeStubRender } from './render-stub';
import type { Column } from './types';

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
const cols: Column<Row>[] = [{ key: 'name', header: 'Name', value: (r) => r.name, sortable: true }];
/** Column-position assertions need more than one column to be meaningful. */
const threeCols: Column<Row>[] = [
  { key: 'id', header: 'Id', value: (r) => r.id },
  { key: 'name', header: 'Name', value: (r) => r.name },
  { key: 'extra', header: 'Extra', value: () => '' },
];
const rows: Row[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
];

function Harness(props: Partial<ComponentProps<typeof Table<Row>>>) {
  return (
    <div style={{ height: 400 }}>
      <Table<Row>
        columns={cols}
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

describe('<Table> engine — header', () => {
  it('renders a header cell per column via the th slot', () => {
    const { container } = render(<Harness />);
    const th = container.querySelectorAll('[data-slot="th"]');
    expect(th.length).toBe(1);
    expect(th[0]).toHaveTextContent('Name');
  });

  it('calls onSortChange with single-toggle on header click', () => {
    const onSortChange = vi.fn();
    const { container } = render(<Harness onSortChange={onSortChange} />);
    const th = container.querySelector('[data-slot="th"]') as HTMLElement;
    fireEvent.click(th);
    expect(onSortChange).toHaveBeenCalledWith([{ field: 'name', direction: 'asc' }]);
  });

  it('calls onSortChange with multi-toggle on shift-click', () => {
    const onSortChange = vi.fn();
    const { container } = render(
      <Harness
        state={{ sort: [{ field: 'other', direction: 'asc' }], widths: {} }}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(container.querySelector('[data-slot="th"]') as HTMLElement, {
      shiftKey: true,
    });
    expect(onSortChange).toHaveBeenCalledWith([
      { field: 'other', direction: 'asc' },
      { field: 'name', direction: 'asc' },
    ]);
  });

  // A render set styles the table's leading column differently from the rest,
  // and `column.key` cannot tell it which one that is. Header and body must
  // agree on the answer or the two fall out of horizontal alignment, so both
  // slots are checked against the same three columns.
  it('tells the th slot which column position it is rendering', () => {
    const { container } = render(<Harness columns={threeCols} />);
    const indices = [...container.querySelectorAll('[data-slot="th"]')].map((el) =>
      el.getAttribute('data-column-index'),
    );
    expect(indices).toEqual(['0', '1', '2']);
  });

  it('gives the td slot the same column positions as the th slot', () => {
    const { container } = render(<Harness columns={threeCols} rows={[rows[0] as Row]} />);
    const indices = [...container.querySelectorAll('[data-slot="td"]')].map((el) =>
      el.getAttribute('data-column-index'),
    );
    expect(indices).toEqual(['0', '1', '2']);
  });
});

describe('<Table> engine — body', () => {
  it('renders a tr per row via the tr slot', () => {
    const { container } = render(<Harness />);
    const rowsRendered = container.querySelectorAll('[data-slot="tr"]');
    expect(rowsRendered.length).toBe(2);
  });

  it('renders one td per (row × column) via the td slot', () => {
    const { container } = render(<Harness />);
    expect(container.querySelectorAll('[data-slot="td"]').length).toBe(2);
  });

  it('passes the row data to the td slot through column.value', () => {
    const { container } = render(<Harness />);
    const cells = container.querySelectorAll('[data-slot="td"]');
    expect(cells[0]).toHaveTextContent('Alpha');
    expect(cells[1]).toHaveTextContent('Beta');
  });

  it('calls onRowClick with the clicked row', () => {
    const onRowClick = vi.fn();
    const { container } = render(<Harness onRowClick={onRowClick} />);
    fireEvent.click(container.querySelectorAll('[data-slot="tr"]')[0] as HTMLElement);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it('renders the body inside the tbody slot with totalSize', () => {
    const { container } = render(<Harness />);
    const tbody = container.querySelector('[data-slot="tbody"]');
    expect(tbody).not.toBeNull();
    expect(Number(tbody?.getAttribute('data-total-size'))).toBeGreaterThan(0);
  });
});

describe('<Table> engine — states', () => {
  it('renders skeleton rows when isLoading and rows are empty', () => {
    const { container } = render(<Harness rows={[]} isLoading />);
    expect(container.querySelectorAll('[data-slot="skeleton-row"]').length).toBeGreaterThan(0);
    expect(container.querySelector('[data-slot="tbody"]')).toBeNull();
  });

  // Fix 7: a compact table's skeleton placeholders must match the real row
  // height passed in, not the engine's hardcoded ROW_HEIGHT default.
  it('sizes skeleton rows to the caller-supplied row height', () => {
    const { container } = render(<Harness rows={[]} isLoading rowHeight={64} />);
    const skeletonRow = container.querySelector('[data-slot="skeleton-row"]') as HTMLElement;
    expect(skeletonRow).toHaveAttribute('data-row-height', '64');
  });

  it('renders the empty slot instead of a body when not loading and rows are empty', () => {
    const { container } = render(<Harness rows={[]} isLoading={false} />);
    expect(container.querySelector('[data-slot="tbody"]')).toBeNull();
    expect(container.querySelector('[data-slot="skeleton-row"]')).toBeNull();
    expect(container.querySelector('[data-slot="empty"]')).not.toBeNull();
  });

  // The engine is handed rows, never the query behind them, so it cannot tell
  // "nothing exists" from "the filters hide everything" on its own.
  it('forwards isFiltered to the empty slot', () => {
    const { container } = render(<Harness rows={[]} isLoading={false} />);
    expect(container.querySelector('[data-slot="empty"]')).toHaveAttribute('data-filtered', 'false');
  });

  it('reports a filtered-empty table as filtered', () => {
    const { container } = render(<Harness rows={[]} isLoading={false} isFiltered />);
    expect(container.querySelector('[data-slot="empty"]')).toHaveAttribute('data-filtered', 'true');
  });

  it('prefers the skeleton over the empty slot while loading', () => {
    const { container } = render(<Harness rows={[]} isLoading />);
    expect(container.querySelector('[data-slot="skeleton-row"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="empty"]')).toBeNull();
  });

  it('prefers the error slot over the empty slot', () => {
    const { container } = render(<Harness rows={[]} isLoading={false} error={new Error('nope')} />);
    expect(container.querySelector('[data-slot="error"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="empty"]')).toBeNull();
  });

  it('renders a row overlay inside every row', () => {
    const { container } = render(<Harness rowOverlay={(row) => <b>{`⋯${row.name}`}</b>} />);
    const overlays = [...container.querySelectorAll('[data-slot="row-overlay"]')];
    expect(overlays.map((el) => el.textContent)).toEqual(['⋯Alpha', '⋯Beta']);
  });

  it('renders no overlay when the caller supplies none', () => {
    const { container } = render(<Harness />);
    expect(container.querySelector('[data-slot="row-overlay"]')).toBeNull();
  });

  it('renders the error slot in place of everything when error is set', () => {
    const { container } = render(<Harness error={new Error('boom')} />);
    const errSlot = container.querySelector('[data-slot="error"]');
    expect(errSlot).toHaveTextContent('boom');
    expect(container.querySelector('[data-slot="root"]')).toBeNull();
  });
});

describe('<Table> engine — sizing', () => {
  it('uses a caller-supplied row height for virtual positioning', () => {
    const { container } = render(<Harness rowHeight={64} />);
    const first = container.querySelectorAll('[data-slot="tr"]')[0] as HTMLElement;
    expect(first.style.height).toBe('64px');
  });

  it('falls back to the default row height', () => {
    const { container } = render(<Harness />);
    const first = container.querySelectorAll('[data-slot="tr"]')[0] as HTMLElement;
    expect(first.style.height).toBe('40px');
  });

  it('stacks rows by the supplied height rather than the default', () => {
    const { container } = render(<Harness rowHeight={64} />);
    const second = container.querySelectorAll('[data-slot="tr"]')[1] as HTMLElement;
    expect(second.style.transform).toBe('translateY(64px)');
  });

  it('emits a numeric column width as pixels', () => {
    const { container } = render(
      <Harness columns={[{ key: 'name', header: 'Name', value: (r) => r.name, width: 200 }]} />,
    );
    expect(container.querySelector('[data-slot="thead"]')).toHaveAttribute(
      'data-grid-template',
      '200px',
    );
  });

  // minmax(240px, 1fr) is what all-items-screen's Title column needs, and no
  // number can express it.
  it('emits a string column width verbatim so track functions survive', () => {
    const { container } = render(
      <Harness
        columns={[
          { key: 'name', header: 'Name', value: (r) => r.name, width: 'minmax(240px, 1fr)' },
        ]}
      />,
    );
    expect(container.querySelector('[data-slot="thead"]')).toHaveAttribute(
      'data-grid-template',
      'minmax(240px, 1fr)',
    );
  });

  it('lets a resized width override a string column width', () => {
    const { container } = render(
      <Harness
        columns={[
          { key: 'name', header: 'Name', value: (r) => r.name, width: 'minmax(240px, 1fr)' },
        ]}
        state={{ sort: [], widths: { name: 300 } }}
      />,
    );
    expect(container.querySelector('[data-slot="thead"]')).toHaveAttribute(
      'data-grid-template',
      '300px',
    );
  });

  // Task 4's guard: a string width has no pixel start, so the resize handle
  // must fall back to 160 rather than seeding `NaN` into the drag maths.
  it('seeds the resize handle with a number even for a track-function column', () => {
    const { container } = render(
      <Harness
        columns={[
          { key: 'name', header: 'Name', value: (r) => r.name, width: 'minmax(240px, 1fr)' },
        ]}
      />,
    );
    const th = container.querySelector('[data-slot="th"]') as HTMLElement;
    expect(th.getAttribute('data-start-width')).toBe('160');
  });

  // Fix 2: a string PIXEL width (all-items' 'key' column is '96px') does have
  // a single pixel start, so the resize handle must recover it rather than
  // falling back to 160 — grabbing a 96px column should not jump it to 160px.
  it('recovers a pixel start from a leading `<n>px` string width', () => {
    const { container } = render(
      <Harness columns={[{ key: 'name', header: 'Name', value: (r) => r.name, width: '96px' }]} />,
    );
    const th = container.querySelector('[data-slot="th"]') as HTMLElement;
    expect(th.getAttribute('data-start-width')).toBe('96');
  });
});

describe('<Table> engine — grouping', () => {
  const grouped = [
    { key: 'a', header: 'Group A', rows: [{ id: '1', name: 'Alpha' }] },
    { key: 'b', header: 'Group B', rows: [{ id: '2', name: 'Beta' }] },
  ];

  it('renders a header per group through the groupHeader slot', () => {
    const { container } = render(<Harness rows={[]} groups={grouped} />);
    const headers = container.querySelectorAll('[data-slot="group-header"]');
    expect(headers.length).toBe(2);
    expect(headers[0]).toHaveTextContent('Group A');
  });

  it('renders each group\'s rows through the tr slot', () => {
    const { container } = render(<Harness rows={[]} groups={grouped} />);
    expect(container.querySelectorAll('[data-slot="tr"]').length).toBe(2);
  });

  it('positions group headers at their own height, not the row height', () => {
    const { container } = render(<Harness rows={[]} groups={grouped} rowHeight={40} />);
    const header = container.querySelector('[data-slot="group-header"]') as HTMLElement;
    expect(header.style.height).toBe('34px');
  });

  it('offsets the second group by its predecessor\'s header plus rows', () => {
    const { container } = render(<Harness rows={[]} groups={grouped} rowHeight={40} />);
    const headers = container.querySelectorAll('[data-slot="group-header"]');
    // group A header (34) + one row (40) = 74
    expect((headers[1] as HTMLElement).style.transform).toBe('translateY(74px)');
  });

  it('gives onRowClick the right row from the second group', () => {
    const onRowClick = vi.fn();
    const { container } = render(
      <Harness rows={[]} groups={grouped} onRowClick={onRowClick} />,
    );
    const trs = container.querySelectorAll('[data-slot="tr"]');
    fireEvent.click(trs[1] as HTMLElement);
    expect(onRowClick).toHaveBeenCalledWith(grouped[1]!.rows[0]);
  });

  it('still renders a flat list when given rows instead of groups', () => {
    const { container } = render(<Harness />);
    expect(container.querySelectorAll('[data-slot="group-header"]').length).toBe(0);
    expect(container.querySelectorAll('[data-slot="tr"]').length).toBe(2);
  });
});
