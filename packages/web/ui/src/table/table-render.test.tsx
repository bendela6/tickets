import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Table, type Column } from '@tickets/table';
import { tableRender } from './table-render';

// jsdom does no layout, so the scroll container's real size is always 0x0 and
// the virtualizer (which measures via ResizeObserver) would compute an empty
// visible range — every row-content assertion below would fail even though
// the engine is correct. @tickets/table's own Table.test.tsx hits the same
// gap and fixes it with an identical test-file-local mock rather than a
// shared one, so this mirrors that precedent instead of inventing a new one.
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
  count: number;
}

const rows: Row[] = [
  { id: '1', name: 'Alpha', count: 3 },
  { id: '2', name: 'Beta', count: 7 },
];
const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', value: (r) => r.name, sortable: true },
  { key: 'count', header: 'Count', value: (r) => r.count, align: 'right' },
];

function Harness(props: Partial<React.ComponentProps<typeof Table<Row>>>) {
  return (
    <div style={{ height: 400 }}>
      <Table<Row>
        columns={columns}
        rows={rows}
        state={{ sort: [], widths: {} }}
        onSortChange={() => {}}
        onWidthChange={() => {}}
        isLoading={false}
        render={tableRender<Row>()}
        {...props}
      />
    </div>
  );
}

describe('tableRender', () => {
  it('exposes the table to assistive tech as a grid of rows and cells', () => {
    render(<Harness />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getAllByRole('cell').length).toBe(4);
  });

  it("renders each cell's value", () => {
    render(<Harness />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('makes only sortable headers activatable', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /Name/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Count/ })).not.toBeInTheDocument();
  });

  it('reports the sort direction on the sorted header', () => {
    render(<Harness state={{ sort: [{ field: 'name', direction: 'asc' }], widths: {} }} />);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('sorts when a sortable header is activated', async () => {
    const onSortChange = vi.fn();
    render(<Harness onSortChange={onSortChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSortChange).toHaveBeenCalledWith([{ field: 'name', direction: 'asc' }]);
  });

  it('offers a resize handle per resizable column', () => {
    render(<Harness />);
    expect(screen.getAllByRole('separator')).toHaveLength(2);
  });

  it('announces an error instead of the table', () => {
    render(<Harness error={new Error('boom')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
  });

  it('shows placeholder rows while loading an empty table', () => {
    const { container } = render(<Harness rows={[]} isLoading />);
    expect(container.querySelectorAll('[data-skeleton-row]').length).toBeGreaterThan(0);
  });

  // The empty state renders INSIDE the table, so the column header stays above
  // it — that is the whole reason the slot exists rather than the caller
  // placing its own empty state beside the table.
  it('keeps the header above an empty table', () => {
    render(<Harness rows={[]} isLoading={false} />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
  });

  it('says something different when filters are what emptied it', () => {
    render(<Harness rows={[]} isLoading={false} isFiltered />);
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('renders row overlay content inside the row', () => {
    render(<Harness rowOverlay={() => <span>peek</span>} />);
    expect(screen.getAllByText('peek')).toHaveLength(rows.length);
  });
});

// The engine decides WHICH cell is focused; these check the adapter honours
// the two things it is handed. The ring itself is a class, and asserting
// classes is not this project's idea of a test — but `focusProps` is a
// contract: drop it and keyboard navigation silently stops working, because
// the engine can no longer find a cell it did not render.
describe('tableRender — cell focus', () => {
  it("puts the engine's coordinates on every cell", () => {
    const { container } = render(<Harness onFocusChange={() => {}} />);
    const cell = container.querySelector('[data-cell-row="0"][data-cell-col="name"]');
    expect(cell).not.toBeNull();
    expect(cell).toHaveAttribute('role', 'cell');
  });

  it('addresses header cells as row -1', () => {
    const { container } = render(<Harness onFocusChange={() => {}} />);
    const header = container.querySelector('[data-cell-row="-1"][data-cell-col="name"]');
    expect(header).toHaveAttribute('role', 'columnheader');
  });

  it('carries the roving tab stop onto the focused cell', () => {
    const { container } = render(
      <Harness
        onFocusChange={() => {}}
        state={{ sort: [], widths: {}, focused: { rowIndex: 1, columnKey: 'count' } }}
      />,
    );
    const stops = container.querySelectorAll('[data-cell-row][tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAttribute('data-cell-col', 'count');
  });
});

describe('tableRender — groups', () => {
  const grouped = [
    { key: 'a', header: <span>Group A</span>, rows: [rows[0]!] },
    { key: 'b', header: <span>Group B</span>, rows: [rows[1]!] },
  ];

  it('renders each group header', () => {
    render(<Harness rows={[]} groups={grouped} />);
    expect(screen.getByText('Group A')).toBeInTheDocument();
    expect(screen.getByText('Group B')).toBeInTheDocument();
  });

  it("renders each group's rows under it", () => {
    render(<Harness rows={[]} groups={grouped} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('marks group headers as rows so the grid semantics stay whole', () => {
    render(<Harness rows={[]} groups={grouped} />);
    expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(4);
  });
});
