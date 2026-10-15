import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeResizeObserver } from './test/resize-observer';
import { useResizeHandle, type UseResizeHandleOptions } from './use-resize-handle';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const POINTER = { pointerId: 1, button: 0 };

/** Gives `element` a size, as getBoundingClientRect reports it; jsdom lays nothing out. */
function sized(element: Element, width: number, height: number) {
  element.getBoundingClientRect = () => {
    return {
      width,
      height,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      toJSON: () => ({}),
    };
  };
}

/** Drags `handle` from (0, 0) by `dx` and `dy`, and lets go. */
function dragBy(handle: Element, dx: number, dy: number, { letGo = true } = {}) {
  fireEvent.pointerDown(handle, { ...POINTER, clientX: 0, clientY: 0 });
  fireEvent.pointerMove(handle, { ...POINTER, clientX: dx, clientY: dy });
  if (letGo) {
    fireEvent.pointerUp(handle, { ...POINTER, clientX: dx, clientY: dy });
  }
}

// The plain views it drives, as on its page: no component of bh's.

/** A box made taller or shorter from its bottom edge, the height the hook's. */
function Box(options: Partial<UseResizeHandleOptions>) {
  const handle = useResizeHandle<HTMLDivElement>({
    orientation: 'horizontal',
    defaultValue: 144,
    min: 96,
    max: 320,
    ...options,
  });
  return (
    <>
      <div ref={handle.ref} data-testid="box" style={{ height: handle.value }} />
      <div {...handle.getSeparatorProps({ 'aria-label': 'Resize the box' })} />
      <output>{`${String(handle.value)}${handle.isDragging ? ' dragging' : ''}`}</output>
    </>
  );
}

/** Two panes split by a line the page holds, in the box the line sits in. */
function Split(options: Partial<UseResizeHandleOptions>) {
  const [share, setShare] = useState(0.5);
  const handle = useResizeHandle({
    orientation: 'vertical',
    unit: 'share',
    value: share,
    onChange: setShare,
    min: 0.2,
    max: 0.8,
    ...options,
  });
  return (
    <div data-testid="split">
      <div {...handle.getSeparatorProps({ 'aria-label': 'Split the panes' })} />
      <output>{share}</output>
    </div>
  );
}

const separator = () => screen.getByRole('separator');
const said = () => screen.getByRole('status').textContent;

describe('useResizeHandle', () => {
  describe('held by the hook', () => {
    it('starts at defaultValue, and moves a step at an arrow key, within its bounds', async () => {
      const user = userEvent.setup();
      render(<Box />);
      expect(said()).toBe('144');
      await user.tab();
      expect(separator()).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(said()).toBe('168');
      await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
      expect(said()).toBe('96');
      await user.keyboard('{ArrowLeft}{ArrowRight}');
      expect(said()).toBe('96');
    });

    it('drags from the size the element has as it is grabbed', () => {
      render(<Box />);
      // CSS holds the box at 200, whatever its value: the edge stays under the pointer.
      sized(screen.getByTestId('box'), 400, 200);
      dragBy(separator(), 0, 30, { letGo: false });
      expect(said()).toBe('230 dragging');
      fireEvent.pointerUp(separator(), { ...POINTER, clientX: 0, clientY: 30 });
      expect(said()).toBe('230');
    });

    it('drags from the value when nothing is measured', () => {
      render(<Box />);
      dragBy(separator(), 0, 30);
      expect(said()).toBe('174');
    });

    it('keeps a drag within min and max, in whole pixels', () => {
      render(<Box />);
      dragBy(separator(), 0, 999);
      expect(said()).toBe('320');
      dragBy(separator(), 0, -999);
      expect(said()).toBe('96');
      dragBy(separator(), 0, 10.6);
      expect(said()).toBe('107');
    });

    it('is the element’s own size, measured, while none is set', () => {
      const observer = fakeResizeObserver();
      render(<Box defaultValue={undefined} />);
      // Measured as it mounts, where jsdom lays it out at nothing.
      expect(said()).toBe('0');
      observer.resize(screen.getByTestId('box'), 400, 180);
      expect(said()).toBe('180');
      expect(separator()).toHaveAttribute('aria-valuenow', '180');
    });

    it('starts a share at a half', () => {
      const { result } = renderHook(() => {
        return useResizeHandle({ orientation: 'vertical', unit: 'share' });
      });
      expect(result.current.value).toBe(0.5);
    });
  });

  describe('held by the caller', () => {
    it('shows the value it is given, and asks onChange for a change', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => {
        return useResizeHandle({ orientation: 'vertical', value: 240, onChange });
      });
      act(() => result.current.setValue(300));
      expect(onChange).toHaveBeenCalledWith(300);
      expect(result.current.value).toBe(240);
    });

    it('takes null as no size set: the element’s own size is the value', () => {
      const observer = fakeResizeObserver();
      const onChange = vi.fn();
      render(<Box value={null} defaultValue={undefined} onChange={onChange} />);
      observer.resize(screen.getByTestId('box'), 400, 150);
      expect(said()).toBe('150');
      sized(screen.getByTestId('box'), 400, 150);
      fireEvent.keyDown(separator(), { key: 'ArrowDown' });
      expect(onChange).toHaveBeenCalledWith(174);
    });

    it('moves a share the page holds by the drag over the size of the box it sits in', () => {
      render(<Split />);
      sized(screen.getByTestId('split'), 400, 100);
      dragBy(separator(), 40, 0);
      expect(said()).toBe('0.6');
      dragBy(separator(), -400, 0);
      expect(said()).toBe('0.2');
    });
  });

  describe('a change, said to be done', () => {
    it('hears each move, and is done once when the drag is let go', () => {
      const onChange = vi.fn();
      const onCommit = vi.fn();
      render(<Box onChange={onChange} onCommit={onCommit} />);
      fireEvent.pointerDown(separator(), { ...POINTER, clientX: 0, clientY: 0 });
      fireEvent.pointerMove(separator(), { ...POINTER, clientX: 0, clientY: 10 });
      fireEvent.pointerMove(separator(), { ...POINTER, clientX: 0, clientY: 20 });
      expect(onChange.mock.calls).toEqual([[154], [164]]);
      expect(onCommit).not.toHaveBeenCalled();
      fireEvent.pointerUp(separator(), { ...POINTER, clientX: 0, clientY: 20 });
      expect(onCommit.mock.calls).toEqual([[164]]);
    });

    it('says nothing is done for a press that moved nothing', () => {
      const onCommit = vi.fn();
      render(<Box onCommit={onCommit} />);
      fireEvent.pointerDown(separator(), { ...POINTER, clientX: 0, clientY: 0 });
      fireEvent.pointerUp(separator(), { ...POINTER, clientX: 0, clientY: 0 });
      expect(onCommit).not.toHaveBeenCalled();
    });

    it('keeps what a drag reached when the browser takes the pointer', () => {
      const onCommit = vi.fn();
      render(<Box onCommit={onCommit} />);
      dragBy(separator(), 0, 40, { letGo: false });
      fireEvent.pointerCancel(separator(), { ...POINTER });
      expect(said()).toBe('184');
      expect(onCommit).toHaveBeenCalledWith(184);
    });

    it('is done at each key, but not at a key that moves nothing', () => {
      const onCommit = vi.fn();
      render(<Box defaultValue={308} onCommit={onCommit} />);
      fireEvent.keyDown(separator(), { key: 'ArrowDown' });
      fireEvent.keyDown(separator(), { key: 'ArrowDown' });
      expect(onCommit.mock.calls).toEqual([[320]]);
    });

    it('is done through setValue, kept within the bounds', () => {
      const onChange = vi.fn();
      const onCommit = vi.fn();
      const { result } = renderHook(() => {
        return useResizeHandle({
          orientation: 'horizontal',
          defaultValue: 200,
          max: 300,
          onChange,
          onCommit,
        });
      });
      act(() => result.current.setValue(999));
      expect(result.current.value).toBe(300);
      expect(onChange).toHaveBeenCalledWith(300);
      expect(onCommit).toHaveBeenCalledWith(300);
    });

    it('is done nowhere for a drag an unmount cuts short', () => {
      const onCommit = vi.fn();
      const { unmount } = render(<Box onCommit={onCommit} />);
      dragBy(separator(), 0, 40, { letGo: false });
      unmount();
      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  describe('which way it moves', () => {
    it('grows a px value as a handle on the start edge moves back', () => {
      render(<Box orientation="vertical" edge="start" />);
      dragBy(separator(), -20, 0);
      expect(said()).toBe('164');
      fireEvent.keyDown(separator(), { key: 'ArrowLeft' });
      expect(said()).toBe('188');
      fireEvent.keyDown(separator(), { key: 'ArrowRight' });
      expect(said()).toBe('164');
    });

    it('moves a share forward with the forward arrow of its orientation', () => {
      const { unmount } = render(<Split />);
      fireEvent.keyDown(separator(), { key: 'ArrowRight' });
      expect(said()).toBe('0.55');
      fireEvent.keyDown(separator(), { key: 'ArrowDown' });
      expect(said()).toBe('0.55');
      unmount();
      render(<Split orientation="horizontal" />);
      fireEvent.keyDown(separator(), { key: 'ArrowDown' });
      expect(said()).toBe('0.55');
      fireEvent.keyDown(separator(), { key: 'ArrowUp' });
      fireEvent.keyDown(separator(), { key: 'ArrowUp' });
      expect(said()).toBe('0.45');
    });

    it('measures a share against its ref’s element over the separator’s parent', () => {
      function Ref() {
        const [share, setShare] = useState(0.5);
        const handle = useResizeHandle<HTMLDivElement>({
          orientation: 'vertical',
          unit: 'share',
          value: share,
          onChange: setShare,
        });
        return (
          <>
            <div ref={handle.ref} data-testid="box" />
            <div data-testid="parent">
              <div {...handle.getSeparatorProps({ 'aria-label': 'Split' })} />
            </div>
            <output>{share}</output>
          </>
        );
      }
      render(<Ref />);
      sized(screen.getByTestId('box'), 200, 100);
      sized(screen.getByTestId('parent'), 1000, 100);
      dragBy(separator(), 20, 0);
      expect(said()).toBe('0.6');
    });

    it('lets a share go by with no box to measure', () => {
      render(<Split />);
      dragBy(separator(), 40, 0);
      expect(said()).toBe('0.5');
    });
  });

  describe('the separator', () => {
    it('is a focusable window splitter, its values in pixels', () => {
      render(<Box />);
      const handle = screen.getByRole('separator', { name: 'Resize the box' });
      expect(handle).toHaveAttribute('aria-orientation', 'horizontal');
      expect(handle).toHaveAttribute('aria-valuenow', '144');
      expect(handle).toHaveAttribute('aria-valuemin', '96');
      expect(handle).toHaveAttribute('aria-valuemax', '320');
      expect(handle).toHaveAttribute('tabindex', '0');
    });

    it('says a share as a percentage', () => {
      render(<Split />);
      const handle = screen.getByRole('separator', { name: 'Split the panes' });
      expect(handle).toHaveAttribute('aria-orientation', 'vertical');
      expect(handle).toHaveAttribute('aria-valuenow', '50');
      expect(handle).toHaveAttribute('aria-valuemin', '20');
      expect(handle).toHaveAttribute('aria-valuemax', '80');
    });

    it('leaves out aria-valuemax for a px value with no max', () => {
      render(<Box max={undefined} />);
      expect(separator()).not.toHaveAttribute('aria-valuemax');
    });

    it('merges your props: both handlers run, yours first', () => {
      const order: string[] = [];
      function Own() {
        const handle = useResizeHandle({ orientation: 'horizontal', defaultValue: 100 });
        return (
          <div
            {...handle.getSeparatorProps({
              'aria-label': 'Resize',
              className: 'edge',
              onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                order.push(`yours ${String(event.defaultPrevented)}`);
              },
              onPointerDown: (_event: PointerEvent<HTMLDivElement>) => {
                order.push('yours down');
              },
            })}
          >
            {handle.value}
          </div>
        );
      }
      render(<Own />);
      const handle = screen.getByRole('separator', { name: 'Resize' });
      expect(handle).toHaveClass('edge');
      fireEvent.keyDown(handle, { key: 'ArrowDown' });
      // Yours ran before the hook took the key.
      expect(order).toEqual(['yours false']);
      expect(handle).toHaveTextContent('124');
      fireEvent.pointerDown(handle, { ...POINTER, clientY: 0 });
      fireEvent.pointerMove(handle, { ...POINTER, clientY: 6 });
      expect(order).toEqual(['yours false', 'yours down']);
      expect(handle).toHaveTextContent('130');
    });
  });

  it('keeps setValue and ref for its life', () => {
    const { result, rerender } = renderHook(() => {
      return useResizeHandle({ orientation: 'horizontal', defaultValue: 100 });
    });
    const { setValue, ref } = result.current;
    act(() => setValue(140));
    rerender();
    expect(result.current.setValue).toBe(setValue);
    expect(result.current.ref).toBe(ref);
  });

  it('calls back once for a change under StrictMode', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const { result } = renderHook(
      () => useResizeHandle({ orientation: 'horizontal', defaultValue: 100, onChange, onCommit }),
      { wrapper: StrictMode },
    );
    act(() => result.current.setValue(140));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
