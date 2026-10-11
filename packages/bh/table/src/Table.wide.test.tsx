/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { act, createEvent, fireEvent, render } from '@testing-library/react';
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
const frameOf = (c: HTMLElement) => c.querySelector('[data-slot="table-frame"]') as HTMLElement;
const pinOf = (
  c: HTMLElement,
  // All four of the table's row shapes, because the pins have to reach all
  // four: the header and the body one cell at a time, the totals row and the
  // skeleton through the map they are handed instead.
  slot: 'th' | 'td' | 'tfoot-cell' | 'skeleton-cell',
  key: string,
) => {
  return [...c.querySelectorAll(`[data-slot="${slot}"][data-key="${key}"]`)][0]?.getAttribute(
    'data-pin',
  );
};

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

  // The totals row and the loading skeleton draw their own cells, so they are
  // handed the whole map rather than one pin per call. They lay out on the
  // same tracks as everything else, and a frozen column that holds still in
  // three of the table's row shapes and slides in the fourth is a table coming
  // apart along its own freeze line.
  it('pins the totals row the same way it pins the body', () => {
    const withFooter = pinned.map((c) => ({ ...c, footer: 'x' }));
    const { container } = render(<Harness columns={withFooter} />);
    expect(pinOf(container, 'tfoot-cell', 'b')).toBe('left:40:edge');
    expect(pinOf(container, 'tfoot-cell', 'c')).toBe('');
    expect(pinOf(container, 'tfoot-cell', 'd')).toBe('right:0:edge');
  });

  it('pins the skeleton the same way it will pin the rows it stands in for', () => {
    const { container } = render(<Harness columns={pinned} rows={[]} isLoading />);
    expect(pinOf(container, 'skeleton-cell', 'b')).toBe('left:40:edge');
    expect(pinOf(container, 'skeleton-cell', 'c')).toBe('');
  });

  // Empty and not absent, so neither slot has to ask whether it may ask.
  it('hands both slots an empty map when nothing is pinned', () => {
    const plain: Column<Row>[] = [{ key: 'name', header: 'Name', width: 40, footer: 'x' }];
    const { container } = render(<Harness columns={plain} />);
    expect(pinOf(container, 'tfoot-cell', 'name')).toBe('');
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

/**
 * The table no longer scrolls itself, so none of this is read off a scroll
 * container any more. Two measurements decide everything: how wide the visible
 * frame is, and how wide the columns add up to. The test renderer does no
 * layout, so the frame's width is faked the way `scrollWidth` used to be, and
 * the column total comes from the authored widths — which is exactly the
 * fallback the engine uses before its first real measurement.
 */
describe('horizontal scroll state', () => {
  const wide: Column<Row>[] = [
    { key: 'name', header: 'Name', width: 500 },
    { key: 'extra', header: 'Extra', width: 500 },
  ];
  const fitFrame = (c: HTMLElement, clientWidth: number) => {
    Object.defineProperty(scrollOf(c), 'clientWidth', { value: clientWidth, configurable: true });
  };
  /**
   * Drag the scrollbar's thumb `px` pixels to the right.
   *
   * The thumb and the table travel different distances: with a 400px frame
   * over a 1000px table the thumb is 160px wide and has 240px of track to
   * cross, so one pixel of thumb is 2.5 pixels of table. Every expectation
   * below is that ratio applied.
   */
  const dragThumb = (c: HTMLElement, px: number) => {
    const thumb = c.querySelector('[data-slot="table-hbar-thumb"]') as HTMLElement;
    fireEvent.pointerDown(thumb, { clientX: 0 });
    fireEvent.pointerMove(thumb, { clientX: px });
    fireEvent.pointerUp(thumb, { clientX: px });
  };

  it('reports no overflow when the table fits', () => {
    const { container, rerender } = render(<Harness columns={wide} />);
    fitFrame(container, 1200);
    rerender(<Harness columns={wide} rows={[...rows]} />);
    expect(frameOf(container)).toHaveAttribute('data-scroll-x', 'none');
  });

  it('reports the start edge when there is more to the right', () => {
    const { container, rerender } = render(<Harness columns={wide} />);
    fitFrame(container, 400);
    rerender(<Harness columns={wide} rows={[...rows]} />);
    expect(frameOf(container)).toHaveAttribute('data-scroll-x', 'start');
  });

  it('reports the middle once scrolled off both edges', () => {
    const { container, rerender } = render(<Harness columns={wide} />);
    fitFrame(container, 400);
    rerender(<Harness columns={wide} rows={[...rows]} />);
    dragThumb(container, 120);
    expect(frameOf(container)).toHaveAttribute('data-scroll-x', 'middle');
  });

  it('reports the end when scrolled all the way right', () => {
    const { container, rerender } = render(<Harness columns={wide} />);
    fitFrame(container, 400);
    rerender(<Harness columns={wide} rows={[...rows]} />);
    dragThumb(container, 400);
    expect(frameOf(container)).toHaveAttribute('data-scroll-x', 'end');
  });

  // The docked scrollbar is the table's own, moved somewhere it can be
  // reached. It exists only while there is something to scroll.
  it('docks a scrollbar only once the table overflows', () => {
    const { container, rerender } = render(<Harness columns={wide} />);
    expect(container.querySelector('[data-slot="table-hbar"]')).toBeNull();
    fitFrame(container, 400);
    rerender(<Harness columns={wide} rows={[...rows]} />);
    expect(container.querySelector('[data-slot="table-hbar"]')).not.toBeNull();
  });

  // A frozen column cancels the slide: the sheet moves left, the cell moves
  // the same distance right, and it lands where it started.
  it('shifts a frozen column by however far the sheet has slid', () => {
    const frozen: Column<Row>[] = [
      { key: 'name', header: 'Name', width: 500, pinned: 'left' },
      { key: 'extra', header: 'Extra', width: 500 },
    ];
    const { container, rerender } = render(<Harness columns={frozen} />);
    fitFrame(container, 400);
    rerender(<Harness columns={frozen} rows={[...rows]} />);
    dragThumb(container, 120);
    expect(
      container.querySelector('[data-slot="th"][data-key="name"]')?.getAttribute('data-pin-shift'),
    ).toBe('300');
  });

  /**
   * The same cancellation, in the row furthest from the engine's per-cell
   * calls — and the one this arrangement was actually reported over.
   *
   * The totals row sticks to the BOTTOM, which says nothing whatever about the
   * sideways axis: it rides inside the sheet like every other row. Without the
   * shift its total slid out from under the column it totals and painted
   * across whatever had scrolled into that column's place.
   */
  it('shifts the totals row with the columns it totals', () => {
    const frozen: Column<Row>[] = [
      { key: 'name', header: 'Name', width: 500, pinned: 'left', footer: '6 rows' },
      { key: 'extra', header: 'Extra', width: 500 },
    ];
    const { container, rerender } = render(<Harness columns={frozen} />);
    fitFrame(container, 400);
    rerender(<Harness columns={frozen} rows={[...rows]} />);
    dragThumb(container, 120);
    expect(
      container
        .querySelector('[data-slot="tfoot-cell"][data-key="name"]')
        ?.getAttribute('data-pin-shift'),
    ).toBe('300');
    // And the column beside it is left where the sheet put it, or the whole
    // row would simply be travelling in the other direction.
    expect(
      container
        .querySelector('[data-slot="tfoot-cell"][data-key="extra"]')
        ?.getAttribute('data-pin-shift'),
    ).toBe('');
  });

  /**
   * Middle-click autoscroll. The browser only offers it over a real scroll
   * container and the table's clip box is not one, so the engine runs the
   * gesture itself — which starts with refusing to let the native one start.
   */
  describe('middle-click pan', () => {
    const middleDown = (el: HTMLElement) => {
      const event = createEvent.pointerDown(el, { button: 1, clientX: 100, clientY: 100 });
      const prevented = !fireEvent(el, event);
      return prevented;
    };

    it('takes over the middle button so the browser does not autoscroll too', () => {
      const { container } = render(<Harness columns={wide} />);
      expect(middleDown(scrollOf(container))).toBe(true);
      expect(scrollOf(container)).toHaveAttribute('data-panning', 'true');
    });

    it('leaves every other button alone', () => {
      const { container } = render(<Harness columns={wide} />);
      fireEvent.pointerDown(scrollOf(container), { button: 0, clientX: 100, clientY: 100 });
      expect(scrollOf(container)).not.toHaveAttribute('data-panning');
    });

    // Press, move, release: the gesture ends with the button.
    it('stops panning when a drag is released', () => {
      const { container } = render(<Harness columns={wide} />);
      middleDown(scrollOf(container));
      fireEvent.pointerMove(window, { clientX: 400, clientY: 100 });
      fireEvent.pointerUp(window, { clientX: 400, clientY: 100 });
      expect(scrollOf(container)).not.toHaveAttribute('data-panning');
    });

    /**
     * The gesture's actual job. Autoscroll runs on a frame loop rather than on
     * pointer moves — it keeps scrolling while the pointer is held still, away
     * from where it started — so the frames are driven by hand here.
     *
     * 200px from the origin, less a 12px dead zone, over a divisor of 9, is
     * ~20.9 pixels of table per frame; the offset lands on whole pixels.
     */
    it('slides the table on every frame while the pointer is held away', () => {
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
      vi.stubGlobal('cancelAnimationFrame', () => {});
      try {
        const { container, rerender } = render(<Harness columns={wide} />);
        fitFrame(container, 400);
        rerender(<Harness columns={wide} rows={[...rows]} />);
        middleDown(scrollOf(container));
        fireEvent.pointerMove(window, { clientX: 300, clientY: 100 });

        const sheet = container.querySelector('[data-slot="table-sheet"]') as HTMLElement;
        act(() => frames.shift()?.(0));
        expect(sheet.style.marginLeft).toBe('-21px');
        act(() => frames.shift()?.(0));
        expect(sheet.style.marginLeft).toBe('-42px');
      } finally {
        vi.unstubAllGlobals();
      }
    });

    // Press and release without moving: panning continues with the pointer
    // free, the way the platform's own click-and-go mode does.
    it('keeps panning after a click that never moved', () => {
      const { container } = render(<Harness columns={wide} />);
      middleDown(scrollOf(container));
      fireEvent.pointerUp(window, { clientX: 100, clientY: 100 });
      expect(scrollOf(container)).toHaveAttribute('data-panning', 'true');
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(scrollOf(container)).not.toHaveAttribute('data-panning');
    });
  });

  /**
   * The soft edges. The engine says WHERE one belongs and how tall it is; what
   * a fade looks like belongs to the render set.
   */
  describe('scrims', () => {
    const kinds = (c: HTMLElement) => {
      return [...c.querySelectorAll('[data-slot="table-scrim"]')].map((el) => {
        return el.getAttribute('data-kind');
      });
    };

    it('marks the hidden right edge as soon as the table overflows', () => {
      const { container, rerender } = render(<Harness columns={wide} />);
      fitFrame(container, 400);
      rerender(<Harness columns={wide} rows={[...rows]} />);
      expect(kinds(container)).toEqual(['end']);
    });

    it('marks both edges once the table has been scrolled off the start', () => {
      const { container, rerender } = render(<Harness columns={wide} />);
      fitFrame(container, 400);
      rerender(<Harness columns={wide} rows={[...rows]} />);
      dragThumb(container, 120);
      expect(kinds(container)).toEqual(['start', 'end']);
    });

    // A frozen column's boundary IS the left edge — drawing the frame's as
    // well would be the same fade in the same place, twice as dark.
    it('puts the left fade on the freeze line when there is one', () => {
      const frozen: Column<Row>[] = [
        { key: 'name', header: 'Name', width: 500, pinned: 'left' },
        { key: 'extra', header: 'Extra', width: 500 },
      ];
      const { container, rerender } = render(<Harness columns={frozen} />);
      fitFrame(container, 400);
      rerender(<Harness columns={frozen} rows={[...rows]} />);
      dragThumb(container, 120);
      expect(kinds(container)).toEqual(['freeze', 'end']);
      expect(
        container.querySelector('[data-slot="table-scrim"][data-kind="freeze"]'),
      ).toHaveAttribute('data-offset', '500');
    });

    it('draws none at all while the whole table fits', () => {
      const { container, rerender } = render(<Harness columns={wide} />);
      fitFrame(container, 1200);
      rerender(<Harness columns={wide} rows={[...rows]} />);
      expect(kinds(container)).toEqual([]);
    });
  });

  /**
   * The last column's right-hand edge. Rules go BETWEEN columns, so that edge
   * is never one of them — which only matters when the columns stop short of
   * the frame and there is empty table after them.
   */
  describe('trailing edge', () => {
    const trailingOf = (c: HTMLElement, slot: 'th' | 'td', key: string) => {
      return c
        .querySelector(`[data-slot="${slot}"][data-key="${key}"]`)
        ?.getAttribute('data-trailing');
    };

    it('rules the last column when the columns do not fill the frame', () => {
      const { container, rerender } = render(<Harness columns={wide} />);
      fitFrame(container, 1400);
      rerender(<Harness columns={wide} rows={[...rows]} />);
      expect(trailingOf(container, 'th', 'extra')).toBe('true');
      expect(trailingOf(container, 'td', 'extra')).toBe('true');
    });

    // That edge is the frame's own border when the columns reach it, and two
    // hairlines a pixel apart is a thicker line, not a tidier one.
    it('leaves it alone when the columns reach the frame', () => {
      const { container, rerender } = render(<Harness columns={wide} />);
      fitFrame(container, 1000);
      rerender(<Harness columns={wide} rows={[...rows]} />);
      expect(trailingOf(container, 'th', 'extra')).toBe('false');
    });

    it('never rules a column that is not the last one', () => {
      const { container, rerender } = render(<Harness columns={wide} />);
      fitFrame(container, 1400);
      rerender(<Harness columns={wide} rows={[...rows]} />);
      expect(trailingOf(container, 'th', 'name')).toBe('false');
    });
  });

  // The class comes from the render set, not the engine — the engine says
  // WHEN there is a hidden edge, never what one looks like.
  it('applies the class the render set chose for that state', () => {
    const withEdge: TableRender<Row> = {
      ...makeStubRender<Row>(),
      frameClass: ({ scrollX }) => `edge-${scrollX}`,
    };
    const { container } = render(<Harness render={withEdge} />);
    expect(frameOf(container)).toHaveClass('edge-none');
  });
});

/**
 * The guideline and the width chip. The handle lives in a header cell 40px
 * tall; the line it needs to draw crosses the whole table. So the cell reports
 * the drag and the engine renders over everything — which is also why none of
 * this can be tested through the handle alone.
 */
describe('resize guideline', () => {
  const guideOf = (c: HTMLElement) => c.querySelector('[data-slot="table-resize-guide"]');

  it('draws nothing until a drag starts', () => {
    const { container } = render(<Harness />);
    expect(guideOf(container)).toBeNull();
  });

  it('appears where the dragged edge would land, with its width and delta', () => {
    const { container } = render(
      <Harness columns={[{ key: 'name', header: 'Name', width: 200 }]} />,
    );
    const th = container.querySelector('[data-slot="th"][data-key="name"]') as HTMLElement;
    // jsdom lays nothing out, so the column's left edge measures as 0 — which
    // is the truth for a first column anyway.
    Object.defineProperty(th, 'offsetLeft', { value: 0, configurable: true });

    const resize = container.querySelector('[data-slot="resize"]') as HTMLElement;
    fireEvent.pointerDown(resize, { clientX: 200 });
    fireEvent.pointerMove(resize, { clientX: 260 });

    const guide = guideOf(container);
    expect(guide).toHaveAttribute('data-width', '260');
    expect(guide).toHaveAttribute('data-delta', '60');
    expect(guide).toHaveAttribute('data-left', '260');
  });

  it('clears when the drag ends', () => {
    const { container } = render(
      <Harness columns={[{ key: 'name', header: 'Name', width: 200 }]} />,
    );
    const resize = container.querySelector('[data-slot="resize"]') as HTMLElement;
    fireEvent.pointerDown(resize, { clientX: 200 });
    fireEvent.pointerMove(resize, { clientX: 260 });
    expect(guideOf(container)).not.toBeNull();
    fireEvent.pointerUp(resize, { clientX: 260 });
    expect(guideOf(container)).toBeNull();
  });
});

/**
 * Refreshing over rows that are already on screen: the opposite of loading,
 * which replaces them with skeletons. Nothing moves; the header says something
 * is happening and the rows read back a step.
 */
describe('refreshing', () => {
  it('tells the header and every row when a refresh is in flight', () => {
    const { container } = render(<Harness isRefreshing />);
    expect(container.querySelector('[data-slot="thead"]')).toHaveAttribute(
      'data-refreshing',
      'true',
    );
    const rendered = [...container.querySelectorAll('[data-slot="tr"]')];
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.every((row) => row.getAttribute('data-dimmed') === 'true')).toBe(true);
  });

  it('keeps the rows rather than replacing them with skeletons', () => {
    const { container } = render(<Harness isRefreshing />);
    expect(container.querySelector('[data-slot="skeleton-row"]')).toBeNull();
  });

  // A refresh with nothing on screen is a load, and a load gets skeletons.
  it('says nothing about refreshing when there are no rows to be stale', () => {
    const { container } = render(<Harness rows={[]} isRefreshing isLoading />);
    expect(container.querySelector('[data-slot="thead"]')).toHaveAttribute(
      'data-refreshing',
      'false',
    );
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

  // The virtualizer sizes the scroll region by adding up the heights it was
  // told. If the function only reached the style and not `estimateSize`, the
  // region would be sized at a flat 40px per row and the scrollbar would lie.
  it('sizes the scroll region from each row own height, not an average', () => {
    const { container } = render(<Harness rowHeight={(_row, i) => (i % 2 === 0 ? 60 : 30)} />);
    const tbody = container.querySelector('[data-slot="tbody"]');
    const expected = rows.reduce((sum, _row, i) => sum + (i % 2 === 0 ? 60 : 30), 0);
    expect(Number(tbody?.getAttribute('data-total-size'))).toBe(expected);
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
