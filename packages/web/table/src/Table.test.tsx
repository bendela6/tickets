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

  it('renders nothing inside root when not loading and rows are empty', () => {
    const { container } = render(<Harness rows={[]} isLoading={false} />);
    expect(container.querySelector('[data-slot="tbody"]')).toBeNull();
    expect(container.querySelector('[data-slot="skeleton-row"]')).toBeNull();
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
