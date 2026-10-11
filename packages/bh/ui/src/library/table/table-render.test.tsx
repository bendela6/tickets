import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Table, type Column } from '@bh/table';
import { focusRing } from '../../style';
import { tableRender } from './table-render';
import { CELL_FOCUS_LIFT, PINNED_CELL, PINNED_EDGE, SELECT_CELL } from './parts/metrics';

// jsdom does no layout, so the scroll container's real size is always 0x0 and
// the virtualizer (which measures via ResizeObserver) would compute an empty
// visible range — every row-content assertion below would fail even though
// the engine is correct. @bh/table's own Table.test.tsx hits the same
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
const [firstRow, secondRow] = rows;
if (!firstRow || !secondRow) {
  throw new Error('the row fixture needs two rows for the grouping tests');
}
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
  it('exposes the table to assistive tech as a grid of rows and grid cells', () => {
    render(<Harness />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getAllByRole('gridcell').length).toBe(4);
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

  // The failure is the BODY of the table, not a replacement for it — the same
  // arrangement as the empty state below, and what A8 asks for: the header
  // stays, so a table that failed to load still looks like the table it is.
  it('announces an error inside the table, under its header', () => {
    render(<Harness error={new Error('boom')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
  });

  it('offers the retry action only when the caller supplies one', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<Harness error={new Error('boom')} />);
    expect(screen.queryByRole('button', { name: 'Retry now' })).not.toBeInTheDocument();
    rerender(<Harness error={new Error('boom')} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry now' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
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
    expect(screen.getByText('No rows match')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
  });

  it('offers to clear the filters only when the caller supplies the action', async () => {
    const onClearFilters = vi.fn();
    render(<Harness rows={[]} isLoading={false} isFiltered onClearFilters={onClearFilters} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
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
    expect(cell).toHaveAttribute('role', 'gridcell');
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

  // The three below are the ring's visual faults of 2026-09-21, and they do
  // assert the thing this file otherwise avoids: a class, or a custom
  // property. jsdom loads no stylesheet, so there is no rendered pixel to
  // compare — but each of these is a DECISION the adapter makes (draw a ring
  // here and not there, how far it may reach, which layer it sits on), and a
  // decision is testable even when its appearance is not.

  it('draws the ring on the focused body cell and nowhere else', () => {
    const { container } = render(
      <Harness
        onFocusChange={() => {}}
        state={{ sort: [], widths: {}, focused: { rowIndex: 1, columnKey: 'count' } }}
      />,
    );
    const rings = container.querySelectorAll('[data-slot="cell-focus-ring"]');
    expect(rings).toHaveLength(1);
    expect(rings[0]?.parentElement).toHaveAttribute('data-cell-row', '1');
    expect(rings[0]?.parentElement).toHaveAttribute('data-cell-col', 'count');
  });

  // A header is a control you click to sort, not a one-cell range, so the
  // model's ring parked an indigo box on it that meant nothing. What must NOT
  // go with it is the focus model: the roving tab stop stays exactly where it
  // was, and the treatment moves to `:focus-visible`, which a keypress fires
  // and a click does not.
  it('leaves no ring on a focused header, only a keyboard treatment', () => {
    const { container } = render(
      <Harness
        onFocusChange={() => {}}
        state={{ sort: [], widths: {}, focused: { rowIndex: -1, columnKey: 'name' } }}
      />,
    );
    expect(container.querySelectorAll('[data-slot="cell-focus-ring"]')).toHaveLength(0);
    const header = screen.getByRole('columnheader', { name: /Name/ });
    expect(header.className).toContain(focusRing('indigo', 'focus-visible', 'inward'));
    expect(header).toHaveAttribute('tabindex', '0');
  });

  // The ring reaches a pixel above itself to cover the border of the row
  // above. On row 0 there is no row above, only the sticky header — which is
  // opaque and has to go on passing over the cells — so that pixel was
  // invisible. The ROW is what knows which row it is, so the row publishes how
  // far the ring may reach and the cell reads it.
  it("keeps the first row's ring inside the cell, where the header cannot cover it", () => {
    const { container } = render(<Harness onFocusChange={() => {}} />);
    const first = container.querySelector('[data-index="0"]') as HTMLElement;
    const second = container.querySelector('[data-index="1"]') as HTMLElement;
    expect(first.style.getPropertyValue('--cell-focus-top')).toBe('0px');
    expect(second.style.getPropertyValue('--cell-focus-top')).toBe('-1px');
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

  // The selection column is the LEADING column, so it was handed the 16px edge
  // gutter that exists for a leading column of TEXT. In a 36px track that left
  // 4px of content box: the tick sat hard against the left edge with the
  // remainder on the other side. Header and body both, because they lay out on
  // one set of tracks and a gutter fixed in one of them is a gutter that now
  // disagrees with the other.
  it('centres the selection column instead of giving it the leading edge gutter', () => {
    const { container } = render(<Selectable />);
    // The select-all cell plus one per row.
    const cells = container.querySelectorAll('[data-cell-col="select"]');
    expect(cells).toHaveLength(rows.length + 1);
    for (const cell of cells) {
      const classes = cell.className.split(' ');
      for (const token of SELECT_CELL.split(' ')) {
        expect(classes).toContain(token);
      }
      expect(classes).not.toContain('px-16');
    }
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

  // The other two row shapes, which have no `data-cell-col` to aim at because
  // they draw their own cells from the column list. The offset has to reach
  // them for exactly the reason it reaches a body cell — it is the only thing
  // cancelling the sheet's slide — and this is the fault the totals row was
  // reported for: at rest it looked right, and it walked out from under its
  // own column the moment the table moved sideways.
  //
  // `PINNED_CELL` is asserted alongside it, against this file's usual rule
  // about classes, because one of its three tokens is `bg-inherit`: a frozen
  // cell that is not opaque shows the columns sliding underneath it, which is
  // the same fault wearing different clothes.
  it('offsets the totals row like the column it totals', () => {
    const withFooter = pinnedColumns.map((c) => ({ ...c, footer: c.key }));
    render(<Harness columns={withFooter} />);
    const cell = screen.getByText('name').closest('[role="gridcell"]') as HTMLElement;
    expect(cell).toHaveStyle({ left: '0px' });
    expect(cell.className.split(' ')).toEqual(expect.arrayContaining(PINNED_CELL.split(' ')));
    const unpinned = screen.getByText('count').closest('[role="gridcell"]') as HTMLElement;
    expect(unpinned.style.left).toBe('');
  });

  it('offsets the loading skeleton like the rows it stands in for', () => {
    const { container } = render(<Harness columns={pinnedColumns} rows={[]} isLoading />);
    const cells = Array.from(container.querySelector('[data-skeleton-row]')?.children ?? []);
    const [pinnedCell, plainCell] = cells as HTMLElement[];
    expect(pinnedCell).toHaveStyle({ left: '0px' });
    expect((pinnedCell?.className ?? '').split(' ')).toEqual(
      expect.arrayContaining(PINNED_CELL.split(' ')),
    );
    expect(plainCell?.style.left).toBe('');
  });

  // A frozen column is no longer positioned FROM an edge — its grid track
  // already puts it where it belongs, and `left` exists only to cancel however
  // far the sheet has slid. At rest that is zero for every pinned column,
  // whatever their widths, which is the difference between this model and the
  // `position: sticky` one it replaced.
  it('holds a second pinned column still rather than offsetting it', () => {
    const two: Column<Row>[] = [
      { key: 'name', header: 'Name', value: (r) => r.name, width: 150, pinned: 'left' },
      { key: 'count', header: 'Count', value: (r) => r.count, width: 100, pinned: 'left' },
    ];
    render(<Harness columns={two} state={{ sort: [], widths: { name: 220 } }} />);
    expect(screen.getByRole('columnheader', { name: /Count/ })).toHaveStyle({ left: '0px' });
  });

  // The two below are the exception this block's preamble allows for: the
  // layer a frozen cell sits on is not a look, it is the reason the focused
  // cell's right-hand edge was invisible. The ring reaches a pixel right to
  // cover the NEIGHBOUR's divider, which works only while it paints above that
  // neighbour — and a frozen neighbour beat it on both counts, a layer of its
  // own and a later position in the row.
  it('lifts a focused frozen cell over the frozen column beside it', () => {
    const { container } = render(
      <Harness
        columns={pinnedColumns}
        onFocusChange={() => {}}
        state={{ sort: [], widths: {}, focused: { rowIndex: 0, columnKey: 'name' } }}
      />,
    );
    const cell = container.querySelector('[data-cell-row="0"][data-cell-col="name"]');
    expect(cell?.className.split(' ')).toContain(CELL_FOCUS_LIFT);
  });

  // Deliberately NOT lifted: an unpinned cell slides under the frozen band
  // when the table scrolls sideways, and one lifted over the band would show
  // through it, fill and all.
  it('leaves a focused unpinned cell in the layer it scrolls in', () => {
    const { container } = render(
      <Harness
        columns={pinnedColumns}
        onFocusChange={() => {}}
        state={{ sort: [], widths: {}, focused: { rowIndex: 0, columnKey: 'count' } }}
      />,
    );
    const cell = container.querySelector('[data-cell-row="0"][data-cell-col="count"]');
    expect(cell?.className.split(' ')).not.toContain(CELL_FOCUS_LIFT);
  });
});

// The other exception the block above allows for, and the one the user
// reported: the freeze edge was a body-row treatment that stopped above the
// header and short of every other row shape, so the boundary read as a stack
// of pieces rather than one edge. What the class NAMES is a look and is not
// tested; WHICH of the table's four row shapes carry it is structure and is
// the whole fix. All four now read the same `pin.edge` flag — they did not
// always, and these are the cases that would notice if they stopped.
describe('tableRender — the frozen band’s edge', () => {
  const frozen: Column<Row>[] = [
    { key: 'name', header: 'Name', value: (r) => r.name, width: 150, pinned: 'left' },
    { key: 'count', header: 'Count', value: (r) => r.count, width: 100 },
  ];
  const edgeLeft = PINNED_EDGE.left.split(' ');

  const classesOf = (el: Element | null | undefined) => (el?.className ?? '').split(' ');

  it('casts from the column header, not only from the rows', () => {
    const { container } = render(<Harness columns={frozen} />);
    expect(classesOf(screen.getByRole('columnheader', { name: /Name/ }))).toEqual(
      expect.arrayContaining(edgeLeft),
    );
    expect(classesOf(container.querySelector('[data-cell-row="0"][data-cell-col="name"]'))).toEqual(
      expect.arrayContaining(edgeLeft),
    );
  });

  // The skeleton and the totals row lay out on the same tracks, and they now
  // read `pin.edge` like the header and the body do rather than re-deriving it
  // from `Column.pinned`. An edge missing from either leaves a gap in it: ten
  // rows of gap while a table loads, 36px of gap above the dock.
  it('carries through the loading skeleton', () => {
    const { container } = render(<Harness columns={frozen} rows={[]} isLoading />);
    const cells = container.querySelector('[data-skeleton-row]')?.children ?? [];
    expect(cells.length).toBe(frozen.length);
    expect(classesOf(cells[0])).toEqual(expect.arrayContaining(edgeLeft));
    expect(classesOf(cells[1])).not.toEqual(expect.arrayContaining(edgeLeft));
  });

  it('carries through the totals row', () => {
    const withFooter = frozen.map((c) => ({ ...c, footer: 'x' }));
    render(<Harness columns={withFooter} />);
    const totals = screen.getAllByText('x')[0]?.closest('[role="gridcell"]');
    expect(classesOf(totals)).toEqual(expect.arrayContaining(edgeLeft));
  });

  // The engine marks one column per side, and all four row shapes now read
  // that one flag. A table with two frozen columns gets one edge, not two —
  // which used to depend on a helper here agreeing with the engine, and now
  // depends on nothing.
  it('marks only the innermost frozen column', () => {
    const two: Column<Row>[] = [
      { key: 'name', header: 'Name', value: (r) => r.name, width: 150, pinned: 'left' },
      { key: 'count', header: 'Count', value: (r) => r.count, width: 100, pinned: 'left' },
    ];
    const { container } = render(<Harness columns={two} rows={[]} isLoading />);
    const cells = container.querySelector('[data-skeleton-row]')?.children ?? [];
    expect(classesOf(cells[0])).not.toEqual(expect.arrayContaining(edgeLeft));
    expect(classesOf(cells[1])).toEqual(expect.arrayContaining(edgeLeft));
  });

  // The third fault in the report: a `border-l` at the boundary that scrolled
  // while the edge stood still. On the right-hand band that divider lands on
  // the edge's own pixel, so `PINNED_EDGE` zeroes it and relies on `cn` to
  // evict the width `cellDivider` asked for. If that eviction ever stops
  // happening the boundary silently becomes two lines again.
  it('leaves one line at a right-pinned boundary, not the divider as well', () => {
    const rightPinned: Column<Row>[] = [
      { key: 'name', header: 'Name', value: (r) => r.name, width: 150 },
      { key: 'count', header: 'Count', value: (r) => r.count, width: 100, pinned: 'right' },
    ];
    const { container } = render(<Harness columns={rightPinned} />);
    const classes = classesOf(
      container.querySelector('[data-cell-row="0"][data-cell-col="count"]'),
    );
    expect(classes).toEqual(expect.arrayContaining(PINNED_EDGE.right.split(' ')));
    expect(classes).not.toContain('border-l-1');
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
    { key: 'a', header: <span>Group A</span>, rows: [firstRow] },
    { key: 'b', header: <span>Group B</span>, rows: [secondRow] },
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
    { key: 'a', header: <span>Group A</span>, rows: [firstRow] },
    { key: 'b', header: <span>Group B</span>, rows: [secondRow] },
  ];

  it('leaves the band inert when the caller has not opted in', () => {
    render(<Harness rows={[]} groups={grouped} />);
    expect(screen.queryByRole('button', { name: /Group A/ })).not.toBeInTheDocument();
  });

  it('makes the whole band a disclosure control', () => {
    render(<Harness rows={[]} groups={grouped} onCollapseChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Group A/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
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

describe('tableRender — header filters', () => {
  const filterColumns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Name',
      value: (r) => r.name,
      sortable: true,
      filter: <input aria-label="Filter name" />,
    },
    { key: 'count', header: 'Count', value: (r) => r.count },
  ];

  it('puts the filter row in the header, where it sticks with the labels', () => {
    render(<Harness columns={filterColumns} />);
    const header = screen.getByRole('columnheader', { name: /Name/ }).closest('[role="rowgroup"]');
    expect(header).not.toBeNull();
    expect(header).toContainElement(screen.getByRole('textbox', { name: 'Filter name' }));
  });

  it('numbers the data rows past the filter row', () => {
    render(<Harness columns={filterColumns} />);
    const dataRows = screen.getAllByRole('row').filter((row) => row.hasAttribute('data-index'));
    expect(dataRows.map((row) => row.getAttribute('aria-rowindex'))).toEqual(['3', '4']);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '4');
  });

  it('keeps a header accessory out of the sort control', async () => {
    const onSortChange = vi.fn();
    const onFilter = vi.fn();
    const withFunnel: Column<Row>[] = [
      {
        ...columns[0],
        key: 'name',
        header: 'Name',
        headerAccessory: (
          <button type="button" onClick={onFilter}>
            Filter name
          </button>
        ),
      },
    ];
    render(<Harness columns={withFunnel} onSortChange={onSortChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filter name' }));
    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onSortChange).not.toHaveBeenCalled();
    // The label still sorts.
    await userEvent.click(screen.getByRole('button', { name: /^Name/ }));
    expect(onSortChange).toHaveBeenCalledTimes(1);
  });
});
