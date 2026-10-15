import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { StrictMode, useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeResizeObserver, layOut } from './test/resize-observer';
import { useElementSize, type UseElementSizeOptions } from './use-element-size';

// The plain view it drives, as on its page: a box that says its size.
function Box({ box, style }: UseElementSizeOptions & { style?: React.CSSProperties }) {
  const { width, height, ref } = useElementSize<HTMLDivElement>({ box });
  return (
    <div ref={ref} role="status" style={style}>
      {width === undefined ? 'unmeasured' : `${String(width)} × ${String(height)}`}
    </div>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useElementSize', () => {
  it('has no size before it has an element', () => {
    const { result } = renderHook(() => useElementSize());
    expect(result.current.width).toBeUndefined();
    expect(result.current.height).toBeUndefined();
  });

  it('measures the element as it mounts', () => {
    fakeResizeObserver();
    layOut(200, 100);
    render(<Box />);
    expect(screen.getByRole('status')).toHaveTextContent('200 × 100');
  });

  it('measures inside the padding and border, unless asked for the border box', () => {
    fakeResizeObserver();
    layOut(200, 100);
    const style = { padding: '10px 20px', border: '2px solid' };
    const { unmount } = render(<Box style={style} />);
    expect(screen.getByRole('status')).toHaveTextContent('156 × 76');
    unmount();
    render(<Box box="border-box" style={style} />);
    expect(screen.getByRole('status')).toHaveTextContent('200 × 100');
  });

  it('follows the element as it changes size', () => {
    const observers = fakeResizeObserver();
    layOut(200, 100);
    render(<Box />);
    const box = screen.getByRole('status');
    observers.resize(box, 320, 120);
    expect(box).toHaveTextContent('320 × 120');
  });

  it('asks the observer for the box it measures', () => {
    const observers = fakeResizeObserver();
    render(<Box box="border-box" />);
    expect(observers.live()[0]?.options).toEqual({ box: 'border-box' });
  });

  it('keeps its size, and commits nothing new, for a measurement that comes out the same', () => {
    const observers = fakeResizeObserver();
    layOut(200, 100);
    let commits = 0;
    function Counted() {
      const { ref } = useElementSize<HTMLDivElement>();
      useEffect(() => {
        commits += 1;
      });
      return <div ref={ref} role="status" />;
    }
    render(<Counted />);
    const before = commits;
    observers.resize(screen.getByRole('status'), 200, 100);
    expect(commits).toBe(before);
    observers.resize(screen.getByRole('status'), 201, 100);
    expect(commits).toBe(before + 1);
  });

  it('does without a ResizeObserver: measured as it mounts, and not again', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    layOut(200, 100);
    render(<Box />);
    expect(screen.getByRole('status')).toHaveTextContent('200 × 100');
  });

  it('has no size again once its element goes, and measures the next one', () => {
    fakeResizeObserver();
    layOut(200, 100);
    function Swapped() {
      const [shown, setShown] = useState(true);
      const { width, ref } = useElementSize<HTMLDivElement>();
      return (
        <>
          <button type="button" onClick={() => setShown(!shown)}>
            {width === undefined ? 'none' : String(width)}
          </button>
          {shown ? <div ref={ref} /> : null}
        </>
      );
    }
    render(<Swapped />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('200');
    fireEvent.click(button);
    expect(screen.getByRole('button')).toHaveTextContent('none');
  });

  it('keeps its ref for its life', () => {
    const { result, rerender } = renderHook(() => useElementSize());
    const { ref } = result.current;
    rerender();
    expect(result.current.ref).toBe(ref);
  });

  it('stops observing once unmounted', () => {
    const observers = fakeResizeObserver();
    const { unmount } = render(<Box />);
    expect(observers.live()).toHaveLength(1);
    unmount();
    expect(observers.live()).toHaveLength(0);
  });

  it('leaves one observer under StrictMode', () => {
    const observers = fakeResizeObserver();
    render(
      <StrictMode>
        <Box />
      </StrictMode>,
    );
    expect(observers.live()).toHaveLength(1);
  });
});
