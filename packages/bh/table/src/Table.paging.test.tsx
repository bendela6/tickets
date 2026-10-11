/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { render, cleanup } from '@testing-library/react';
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

const cols: Column<Row>[] = [{ key: 'name', header: 'Name', value: (r) => r.name }];

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: String(i), name: `Row ${i}` }));
}

function Harness(props: Partial<ComponentProps<typeof Table<Row>>>) {
  return (
    <div style={{ height: 400 }}>
      <Table<Row>
        columns={cols}
        rows={makeRows(5)}
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

describe('<Table> engine — onEndReached', () => {
  it('fires once the window reaches the last rows', () => {
    const onEndReached = vi.fn();
    render(<Harness onEndReached={onEndReached} />);
    expect(onEndReached).toHaveBeenCalledTimes(1);
  });

  it('does not fire while the end of the list is far below the window', () => {
    const onEndReached = vi.fn();
    render(<Harness rows={makeRows(400)} onEndReached={onEndReached} />);
    expect(onEndReached).not.toHaveBeenCalled();
  });

  it('does not fire twice for the same rows', () => {
    const onEndReached = vi.fn();
    const { rerender } = render(<Harness onEndReached={onEndReached} />);
    rerender(<Harness onEndReached={onEndReached} />);
    expect(onEndReached).toHaveBeenCalledTimes(1);
  });

  it('re-arms when a page arrives, so the next end is asked for too', () => {
    const onEndReached = vi.fn();
    const { rerender } = render(<Harness rows={makeRows(5)} onEndReached={onEndReached} />);
    expect(onEndReached).toHaveBeenCalledTimes(1);

    rerender(<Harness rows={makeRows(10)} onEndReached={onEndReached} />);
    expect(onEndReached).toHaveBeenCalledTimes(2);
  });

  it('stays quiet without the prop', () => {
    expect(() => render(<Harness />)).not.toThrow();
  });

  it('does not fire for an empty table', () => {
    const onEndReached = vi.fn();
    render(<Harness rows={[]} onEndReached={onEndReached} />);
    expect(onEndReached).not.toHaveBeenCalled();
  });
});
