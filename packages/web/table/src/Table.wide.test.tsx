/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { Table } from './Table';
import { makeStubRender } from './render-stub';
import type { Column, TableRender } from './types';

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

const rows: Row[] = Array.from({ length: 6 }, (_, i) => ({ id: `r${i}`, name: `Row ${i}` }));

function Harness(props: Partial<ComponentProps<typeof Table<Row>>>) {
  return (
    <div style={{ height: 400 }}>
      <Table<Row>
        columns={[{ key: 'name', header: 'Name', value: (r) => r.name }]}
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

const scrollOf = (c: HTMLElement) => c.querySelector('[data-slot="table-scroll"]') as HTMLElement;
const pinOf = (c: HTMLElement, slot: 'th' | 'td', key: string) =>
  [...c.querySelectorAll(`[data-slot="${slot}"][data-key="${key}"]`)][0]?.getAttribute('data-pin');

describe('column pinning', () => {
  // Widths are known, so the engine can say exactly where each frozen column
  // starts. It cannot leave that to the adapter: only the engine sees the
  // column ORDER and the dragged widths together.
  const pinned: Column<Row>[] = [
    { key: 'a', header: 'A', width: 40, pinned: 'left' },
    { key: 'b', header: 'B', width: 120, pinned: 'left' },
    { key: 'c', header: 'C', width: 300 },
    { key: 'd', header: 'D', width: 90, pinned: 'right' },
  ];

  it('sticks the first left-pinned column to the edge', () => {
    const { container } = render(<Harness columns={pinned} />);
    expect(pinOf(container, 'th', 'a')).toBe('left:0');
  });

  // Past the width of the one before it, or the two would sit on top of
  // each other.
  it("offsets the second left-pinned column by the first one's width", () => {
    const { container } = render(<Harness columns={pinned} />);
    expect(pinOf(container, 'th', 'b')).toBe('left:40:edge');
  });

  it('pins from the other edge on the right', () => {
    const { container } = render(<Harness columns={pinned} />);
    expect(pinOf(container, 'th', 'd')).toBe('right:0:edge');
  });

  it('leaves unpinned columns alone', () => {
    const { container } = render(<Harness columns={pinned} />);
    expect(pinOf(container, 'th', 'c')).toBe('');
  });

  it('pins the body cells to match their headers', () => {
    const { container } = render(<Harness columns={pinned} />);
    expect(pinOf(container, 'td', 'b')).toBe('left:40:edge');
  });

  // Only the INNERMOST frozen column borders the part that scrolls. Marking
  // them all would draw a divider between every frozen column.
  it('marks only the innermost pinned column on each side as the edge', () => {
    const { container } = render(<Harness columns={pinned} />);
    expect(pinOf(container, 'th', 'a')).not.toContain('edge');
    expect(pinOf(container, 'th', 'b')).toContain('edge');
  });

  // A dragged width has to move the offsets with it, or resizing a frozen
  // column makes the next one overlap it.
  it('follows a dragged width', () => {
    const { container } = render(
      <Harness columns={pinned} state={{ sort: [], widths: { a: 200 } }} />,
    );
    expect(pinOf(container, 'th', 'b')).toBe('left:200:edge');
  });

  it('tells the row when the table has a pinned column', () => {
    const { container } = render(<Harness columns={pinned} />);
    expect(container.querySelector('[data-slot="tr"]')).toHaveAttribute('data-has-pinned', 'true');
  });

  it('tells it when the table has none', () => {
    const { container } = render(<Harness />);
    expect(container.querySelector('[data-slot="tr"]')).toHaveAttribute('data-has-pinned', 'false');
  });
});

describe('horizontal scroll state', () => {
  const widen = (el: HTMLElement, scrollWidth: number, clientWidth: number) => {
    Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
    Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
  };

  it('reports no overflow when the table fits', () => {
    const { container } = render(<Harness />);
    expect(scrollOf(container)).toHaveAttribute('data-scroll-x', 'none');
  });

  it('reports the start edge when there is more to the right', () => {
    const { container, rerender } = render(<Harness />);
    widen(scrollOf(container), 2000, 800);
    rerender(<Harness rows={[...rows]} />);
    expect(scrollOf(container)).toHaveAttribute('data-scroll-x', 'start');
  });

  it('reports the middle once scrolled off both edges', () => {
    const { container } = render(<Harness />);
    const el = scrollOf(container);
    widen(el, 2000, 800);
    el.scrollLeft = 400;
    fireEvent.scroll(el);
    expect(el).toHaveAttribute('data-scroll-x', 'middle');
  });

  it('reports the end when scrolled all the way right', () => {
    const { container } = render(<Harness />);
    const el = scrollOf(container);
    widen(el, 2000, 800);
    el.scrollLeft = 1200;
    fireEvent.scroll(el);
    expect(el).toHaveAttribute('data-scroll-x', 'end');
  });

  // The class comes from the render set, not the engine — the engine says
  // WHEN there is a hidden edge, never what one looks like.
  it('applies the class the render set chose for that state', () => {
    const withEdge: TableRender<Row> = {
      ...makeStubRender<Row>(),
      scrollClass: ({ scrollX }) => `edge-${scrollX}`,
    };
    const { container } = render(<Harness render={withEdge} />);
    expect(scrollOf(container)).toHaveClass('edge-none');
  });
});

describe('auto-fit on double-click', () => {
  // Measured, not estimated: only the DOM knows how wide this text is in this
  // font. `scrollWidth` is the FULL content width even where the cell clips
  // it, which is the number a "fit to content" gesture means.
  it('sizes the column to its widest rendered cell', () => {
    const onWidthChange = vi.fn();
    const { container } = render(<Harness onWidthChange={onWidthChange} />);
    const cells = [...container.querySelectorAll('[data-cell-col="name"]')];
    cells.forEach((cell, i) => {
      Object.defineProperty(cell, 'scrollWidth', { value: 100 + i * 10, configurable: true });
    });
    fireEvent.doubleClick(container.querySelector('[data-slot="resize"]') as HTMLElement);
    expect(onWidthChange).toHaveBeenCalledWith('name', 100 + (cells.length - 1) * 10);
  });

  it('never shrinks a column below its minWidth', () => {
    const onWidthChange = vi.fn();
    const { container } = render(
      <Harness
        columns={[{ key: 'name', header: 'Name', value: (r) => r.name, minWidth: 500 }]}
        onWidthChange={onWidthChange}
      />,
    );
    for (const cell of container.querySelectorAll('[data-cell-col="name"]')) {
      Object.defineProperty(cell, 'scrollWidth', { value: 80, configurable: true });
    }
    fireEvent.doubleClick(container.querySelector('[data-slot="resize"]') as HTMLElement);
    expect(onWidthChange).toHaveBeenCalledWith('name', 500);
  });

  // jsdom measures everything as 0, and so does a real browser for a column
  // whose rows have all been virtualized away. Writing that width would
  // collapse the column to nothing.
  it('does nothing when it can measure nothing', () => {
    const onWidthChange = vi.fn();
    const { container } = render(<Harness onWidthChange={onWidthChange} />);
    fireEvent.doubleClick(container.querySelector('[data-slot="resize"]') as HTMLElement);
    expect(onWidthChange).not.toHaveBeenCalled();
  });
});

describe('per-row height', () => {
  it('gives each row the height the function returns', () => {
    const { container } = render(<Harness rowHeight={(_row, i) => (i % 2 === 0 ? 60 : 30)} />);
    const trs = [...container.querySelectorAll('[data-slot="tr"]')] as HTMLElement[];
    expect(trs[0]?.style.height).toBe('60px');
    expect(trs[1]?.style.height).toBe('30px');
  });

  // The virtualizer positions rows by adding up the heights it was told. If
  // the function only reached the style and not `estimateSize`, every row
  // after the first would sit at the wrong offset.
  it('stacks rows by their own heights, not an average', () => {
    const { container } = render(<Harness rowHeight={(_row, i) => (i % 2 === 0 ? 60 : 30)} />);
    const trs = [...container.querySelectorAll('[data-slot="tr"]')] as HTMLElement[];
    expect(trs[1]?.style.transform).toBe('translateY(60px)');
    expect(trs[2]?.style.transform).toBe('translateY(90px)');
  });

  it('passes the row itself to the height function', () => {
    const rowHeight = vi.fn(() => 40);
    render(<Harness rowHeight={rowHeight} />);
    expect(rowHeight).toHaveBeenCalledWith(rows[0], 0);
  });

  it('still accepts a plain number', () => {
    const { container } = render(<Harness rowHeight={64} />);
    const first = container.querySelector('[data-slot="tr"]') as HTMLElement;
    expect(first.style.height).toBe('64px');
  });

  // A placeholder stands in for a row that has not arrived, so there is no
  // row to ask — the base height is the only answer available.
  it('sizes skeletons from the base height', () => {
    const { container } = render(<Harness rows={[]} isLoading rowHeight={() => 999} />);
    const skeleton = container.querySelector('[data-slot="skeleton-row"]');
    expect(skeleton).toHaveAttribute('data-row-height', '40');
  });
});
