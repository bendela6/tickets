import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('tableRender — row selection', () => {
  const selectColumns: Column<Row>[] = [
    { key: 'select', header: '', select: true, width: 36, resizable: false },
    ...columns,
  ];

  function Selectable() {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    return (
      <div style={{ height: 400 }}>
        <Table<Row>
          columns={selectColumns}
          rows={rows}
          state={{ sort: [], widths: {}, selected }}
          onSortChange={() => {}}
          onWidthChange={() => {}}
          getRowId={(r) => r.id}
          onSelectionChange={setSelected}
          isLoading={false}
          render={tableRender<Row>()}
        />
      </div>
    );
  }

  // The column shows no visible text, so the name is the only thing standing
  // between a screen-reader user and a table of anonymous checkboxes.
  it('names the select-all checkbox and every row checkbox', () => {
    render(<Selectable />);
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select row 1' })).toBeInTheDocument();
  });

  it('ticks the row the user selected', async () => {
    render(<Selectable />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select row 2' }));
    expect(screen.getByRole('checkbox', { name: 'Select row 2' })).toBeChecked();
  });

  // A selected row that differs only by background is invisible to a screen
  // reader, and bulk actions are exactly the thing you must be able to check
  // before running.
  it('announces the selected row', async () => {
    render(<Selectable />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select row 1' }));
    const selected = screen.getAllByRole('row').filter((r) => r.ariaSelected === 'true');
    expect(selected).toHaveLength(1);
  });

  it('selects every row from the header checkbox', async () => {
    render(<Selectable />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(screen.getByRole('checkbox', { name: 'Select row 1' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select row 2' })).toBeChecked();
  });

  // The row opens a drawer on click. Ticking a checkbox must not do both —
  // the same trap LinkColumn and ActionsColumn already guard against.
  it('does not let a checkbox click reach the row', async () => {
    const onRowClick = vi.fn();
    render(
      <div style={{ height: 400 }}>
        <Table<Row>
          columns={selectColumns}
          rows={rows}
          state={{ sort: [], widths: {}, selected: new Set() }}
          onSortChange={() => {}}
          onWidthChange={() => {}}
          getRowId={(r) => r.id}
          onSelectionChange={() => {}}
          onRowClick={onRowClick}
          isLoading={false}
          render={tableRender<Row>()}
        />
      </div>,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select row 1' }));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

// jsdom applies no stylesheet, so a class assertion here would prove nothing
// about what a pinned column looks like — and asserting the classes a
// component picks for itself is not what this project tests. What IS testable
// is the one thing the adapter cannot get from a class: the pixel offset,
// which depends on the current column widths and has to reach the inline
// style or a second frozen column lands on top of the first.
describe('tableRender — pinned columns', () => {
  const pinnedColumns: Column<Row>[] = [
    { key: 'name', header: 'Name', value: (r) => r.name, width: 150, pinned: 'left' },
    { key: 'count', header: 'Count', value: (r) => r.count, width: 100 },
  ];

  it('offsets a pinned header cell from its edge', () => {
    render(<Harness columns={pinnedColumns} />);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveStyle({ left: '0px' });
  });

  it('offsets the pinned body cells the same way', () => {
    const { container } = render(<Harness columns={pinnedColumns} />);
    const cell = container.querySelector('[data-cell-row="0"][data-cell-col="name"]');
    expect(cell).toHaveStyle({ left: '0px' });
  });

  it('leaves unpinned cells unpositioned', () => {
    const { container } = render(<Harness columns={pinnedColumns} />);
    const cell = container.querySelector(
      '[data-cell-row="0"][data-cell-col="count"]',
    ) as HTMLElement;
    expect(cell.style.left).toBe('');
  });

  it('follows a dragged width for the second pinned column', () => {
    const two: Column<Row>[] = [
      { key: 'name', header: 'Name', value: (r) => r.name, width: 150, pinned: 'left' },
      { key: 'count', header: 'Count', value: (r) => r.count, width: 100, pinned: 'left' },
    ];
    render(<Harness columns={two} state={{ sort: [], widths: { name: 220 } }} />);
    expect(screen.getByRole('columnheader', { name: /Count/ })).toHaveStyle({ left: '220px' });
  });
});

describe('tableRender — auto-fit', () => {
  // The gesture every spreadsheet has trained people to expect, and the
  // fastest way out of a column that truncates everything.
  it('fits the column to its widest cell when the handle is double-clicked', () => {
    const onWidthChange = vi.fn();
    const { container } = render(<Harness onWidthChange={onWidthChange} />);
    for (const cell of container.querySelectorAll('[data-cell-col="name"]')) {
      Object.defineProperty(cell, 'scrollWidth', { value: 260, configurable: true });
    }
    fireEvent.doubleClick(screen.getAllByRole('separator')[0] as HTMLElement);
    expect(onWidthChange).toHaveBeenCalledWith('name', 260);
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

  it('pins the current group under the header when asked', () => {
    render(<Harness rows={[]} groups={grouped} stickyGroupHeader />);
    // Twice on purpose — once in the row flow, once pinned. The real band is
    // absolutely positioned by the virtualizer and so cannot be made sticky,
    // which is why the pinned one is a second rendering. Only the group the
    // topmost visible row belongs to is pinned.
    expect(screen.getAllByText('Group A')).toHaveLength(2);
    expect(screen.getAllByText('Group B')).toHaveLength(1);
  });

  it('hides the pinned copy from assistive tech so a group is announced once', () => {
    render(<Harness rows={[]} groups={grouped} stickyGroupHeader />);
    const announced = screen
      .getAllByText('Group A')
      .filter((el) => el.closest('[aria-hidden="true"]') === null);
    expect(announced).toHaveLength(1);
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

describe('tableRender — collapsible groups', () => {
  const grouped = [
    { key: 'a', header: <span>Group A</span>, rows: [rows[0]!] },
    { key: 'b', header: <span>Group B</span>, rows: [rows[1]!] },
  ];

  it('leaves the band inert when the caller has not opted in', () => {
    render(<Harness rows={[]} groups={grouped} />);
    expect(screen.queryByRole('button', { name: /Group A/ })).not.toBeInTheDocument();
  });

  it('makes the whole band a disclosure control', () => {
    render(<Harness rows={[]} groups={grouped} onCollapseChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Group A/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('reports a collapsed group as not expanded', () => {
    render(
      <Harness
        rows={[]}
        groups={grouped}
        state={{ sort: [], widths: {}, collapsed: new Set(['a']) }}
        onCollapseChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Group A/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('collapses a group when its band is clicked', async () => {
    const onCollapseChange = vi.fn();
    render(<Harness rows={[]} groups={grouped} onCollapseChange={onCollapseChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Group A/ }));
    expect(onCollapseChange).toHaveBeenCalledWith(new Set(['a']));
  });
});

describe('tableRender — totals row', () => {
  const withFooter: Column<Row>[] = [
    { key: 'name', header: 'Name', value: (r) => r.name, footer: 'Total' },
    { key: 'count', header: 'Count', value: (r) => r.count, align: 'right', footer: '10' },
  ];

  it('renders the totals row as cells of the grid', () => {
    render(<Harness columns={withFooter} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  // It is a row of cells like any other, so a grid whose last row was bare
  // divs would be an aria-required-children violation — the same one the group
  // band and the row overlay each turned out to have.
  it('keeps the totals row a legal grid row', () => {
    render(<Harness columns={withFooter} />);
    const total = screen.getByText('Total');
    expect(total.closest('[role="gridcell"]')).not.toBeNull();
    expect(total.closest('[role="row"]')).not.toBeNull();
  });
});
