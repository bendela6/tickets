import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { act, StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDrag, type UseDragOptions } from './use-drag';

// jsdom has no pointer capture: each handle keeps the pointers it holds, as a
// browser would, so a test can see what is held and let go.
const held = new Map<Element, Set<number>>();

const CAPTURE = {
  setPointerCapture(this: Element, pointerId: number) {
    held.set(this, (held.get(this) ?? new Set()).add(pointerId));
  },
  releasePointerCapture(this: Element, pointerId: number) {
    held.get(this)?.delete(pointerId);
  },
  hasPointerCapture(this: Element, pointerId: number) {
    return held.get(this)?.has(pointerId) ?? false;
  },
};

beforeEach(() => {
  held.clear();
  for (const [name, value] of Object.entries(CAPTURE)) {
    Object.defineProperty(Element.prototype, name, { configurable: true, value });
  }
});

afterEach(() => {
  for (const name of Object.keys(CAPTURE)) {
    Reflect.deleteProperty(Element.prototype, name);
  }
  vi.restoreAllMocks();
});

const POINTER = { pointerId: 1, button: 0 };

// The plain view it drives, as on its page: a handle that sets a width, from
// the width it had when it was grabbed.
function Width(options: Partial<UseDragOptions<number>>) {
  const [width, setWidth] = useState(200);
  const drag = useDrag<number>({
    onStart: () => width,
    onMove: ({ dx, from }) => setWidth(Math.max(80, from + dx)),
    ...options,
  });
  return (
    <>
      <div role="separator" aria-label="Resize" {...drag.getHandleProps()} />
      <output>{`${String(width)}${drag.isDragging ? ' dragging' : ''}`}</output>
    </>
  );
}

const handle = () => screen.getByRole('separator', { name: 'Resize' });
const said = () => screen.getByRole('status').textContent;

describe('useDrag', () => {
  it('runs no drag at first', () => {
    const { result } = renderHook(() => useDrag());
    expect(result.current.isDragging).toBe(false);
  });

  it('follows the pointer from where it went down, from what onStart measured', () => {
    render(<Width />);
    fireEvent.pointerDown(handle(), { ...POINTER, clientX: 100, clientY: 10 });
    expect(said()).toBe('200 dragging');
    fireEvent.pointerMove(handle(), { ...POINTER, clientX: 150, clientY: 10 });
    expect(said()).toBe('250 dragging');
    fireEvent.pointerMove(handle(), { ...POINTER, clientX: 0, clientY: 10 });
    expect(said()).toBe('100 dragging');
    fireEvent.pointerUp(handle(), { ...POINTER, clientX: 0, clientY: 10 });
    expect(said()).toBe('100');
    // A second drag starts from where the first left it.
    fireEvent.pointerDown(handle(), { ...POINTER, clientX: 0, clientY: 10 });
    fireEvent.pointerMove(handle(), { ...POINTER, clientX: -50, clientY: 10 });
    expect(said()).toBe('80 dragging');
  });

  it('reports where the pointer is, and how far it has moved, both ways', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const { result } = renderHook(() => useDrag({ onMove, onEnd }));
    render(<div role="separator" {...result.current.getHandleProps()} />);
    const separator = screen.getByRole('separator');
    fireEvent.pointerDown(separator, { ...POINTER, clientX: 10, clientY: 20 });
    fireEvent.pointerMove(separator, { ...POINTER, clientX: 15, clientY: 12 });
    fireEvent.pointerUp(separator, { ...POINTER, clientX: 16, clientY: 10 });
    expect(onMove).toHaveBeenCalledWith({ x: 15, y: 12, dx: 5, dy: -8, from: undefined });
    expect(onEnd).toHaveBeenCalledWith({ x: 16, y: 10, dx: 6, dy: -10, from: undefined });
  });

  it('captures the pointer for the drag, and lets go of it at the end', () => {
    render(<Width />);
    fireEvent.pointerDown(handle(), { ...POINTER, clientX: 0 });
    expect(held.get(handle())?.has(1)).toBe(true);
    fireEvent.pointerUp(handle(), { ...POINTER, clientX: 0 });
    expect(held.get(handle())?.has(1)).toBe(false);
  });

  it('prevents the press’s default, so no text is selected', () => {
    render(<Width />);
    const down = new PointerEvent('pointerdown', { ...POINTER, bubbles: true, cancelable: true });
    act(() => {
      handle().dispatchEvent(down);
    });
    expect(down.defaultPrevented).toBe(true);
  });

  it('starts only from the main button, nor while disabled, nor when onStart says false', () => {
    const onMove = vi.fn();
    const { unmount } = render(<Width onMove={onMove} />);
    fireEvent.pointerDown(handle(), { pointerId: 1, button: 2, clientX: 0 });
    fireEvent.pointerMove(handle(), { ...POINTER, clientX: 10 });
    unmount();
    render(<Width onMove={onMove} disabled />);
    fireEvent.pointerDown(handle(), { ...POINTER, clientX: 0 });
    fireEvent.pointerMove(handle(), { ...POINTER, clientX: 10 });
    expect(said()).toBe('200');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('lets a press go by when onStart says false', () => {
    const onMove = vi.fn();
    render(<Width onStart={() => false} onMove={onMove} />);
    fireEvent.pointerDown(handle(), { ...POINTER, clientX: 0 });
    fireEvent.pointerMove(handle(), { ...POINTER, clientX: 10 });
    expect(said()).toBe('200');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('follows only the pointer that started it', () => {
    render(<Width />);
    fireEvent.pointerDown(handle(), { ...POINTER, clientX: 0 });
    fireEvent.pointerMove(handle(), { pointerId: 2, clientX: 50 });
    fireEvent.pointerUp(handle(), { pointerId: 2, clientX: 50 });
    expect(said()).toBe('200 dragging');
  });

  it('cancels when the browser takes the pointer, or on cancel', () => {
    const onCancel = vi.fn();
    const onEnd = vi.fn();
    const { result } = renderHook(() => useDrag({ onStart: () => 'grabbed', onCancel, onEnd }));
    render(<div role="separator" {...result.current.getHandleProps()} />);
    const separator = screen.getByRole('separator');
    fireEvent.pointerDown(separator, { ...POINTER, clientX: 0 });
    fireEvent.pointerCancel(separator, POINTER);
    expect(onCancel).toHaveBeenCalledWith('grabbed');
    expect(result.current.isDragging).toBe(false);
    fireEvent.pointerDown(separator, { ...POINTER, clientX: 0 });
    fireEvent.lostPointerCapture(separator, POINTER);
    expect(onCancel).toHaveBeenCalledTimes(2);
    fireEvent.pointerDown(separator, { ...POINTER, clientX: 0 });
    act(() => result.current.cancel());
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(held.get(separator)?.has(1)).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('cancels nothing when the capture goes after a release', () => {
    const onCancel = vi.fn();
    const { result } = renderHook(() => useDrag({ onCancel }));
    render(<div role="separator" {...result.current.getHandleProps()} />);
    const separator = screen.getByRole('separator');
    fireEvent.pointerDown(separator, { ...POINTER, clientX: 0 });
    fireEvent.pointerUp(separator, { ...POINTER, clientX: 0 });
    fireEvent.lostPointerCapture(separator, POINTER);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('runs the caller’s own handlers first, and passes its other props through', () => {
    const seen: string[] = [];
    function Own() {
      const drag = useDrag({ onStart: () => void seen.push('hook') });
      return (
        <div
          {...drag.getHandleProps({
            role: 'separator',
            'aria-label': 'Resize',
            onPointerDown: () => seen.push('caller'),
          })}
        />
      );
    }
    render(<Own />);
    fireEvent.pointerDown(handle(), { ...POINTER, clientX: 0 });
    expect(seen).toEqual(['caller', 'hook']);
  });

  it('calls the latest callbacks, memoised or not', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ onMove }) => useDrag({ onMove }), {
      initialProps: { onMove: first },
    });
    render(<div role="separator" {...result.current.getHandleProps()} />);
    const separator = screen.getByRole('separator');
    fireEvent.pointerDown(separator, { ...POINTER, clientX: 0 });
    rerender({ onMove: second });
    fireEvent.pointerMove(separator, { ...POINTER, clientX: 5 });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps cancel and its getter for its life', () => {
    const { result, rerender } = renderHook(() => useDrag());
    const { cancel, getHandleProps } = result.current;
    rerender();
    expect(result.current.cancel).toBe(cancel);
    expect(result.current.getHandleProps).toBe(getHandleProps);
  });

  it('moves once a move under StrictMode', () => {
    const onMove = vi.fn();
    function Strict() {
      const drag = useDrag({ onMove });
      return <div role="separator" aria-label="Resize" {...drag.getHandleProps()} />;
    }
    render(
      <StrictMode>
        <Strict />
      </StrictMode>,
    );
    fireEvent.pointerDown(handle(), { ...POINTER, clientX: 0 });
    fireEvent.pointerMove(handle(), { ...POINTER, clientX: 5 });
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('lets go of the pointer, and calls nothing, when unmounted mid-drag', () => {
    const onEnd = vi.fn();
    const onCancel = vi.fn();
    const { unmount } = render(<Width onEnd={onEnd} onCancel={onCancel} />);
    const separator = handle();
    fireEvent.pointerDown(separator, { ...POINTER, clientX: 0 });
    expect(held.get(separator)?.has(1)).toBe(true);
    unmount();
    expect(held.get(separator)?.has(1)).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
