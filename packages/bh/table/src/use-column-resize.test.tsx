/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useColumnResize } from './use-column-resize';

afterEach(cleanup);

// Mirrors how the render set nests the handle: absolutely positioned inside
// the header cell, which carries the engine's `data-cell-col` attribute.
function Harness(props: { startWidth: number; minWidth?: number; onChange: (px: number) => void }) {
  const handlers = useColumnResize(props);
  return (
    <div role="columnheader" data-cell-col="name">
      <div role="separator" data-testid="handle" {...handlers} />
    </div>
  );
}

describe('useColumnResize', () => {
  it('emits onChange with delta-shifted width on pointer drag', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness startWidth={150} minWidth={64} onChange={onChange} />);
    const handle = getByTestId('handle');
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 130, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(180);

    fireEvent.pointerMove(handle, { clientX: 0, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(64);

    fireEvent.pointerUp(handle, { clientX: 0, pointerId: 1 });
  });

  it('drags from the header cell RENDERED width, not the guessed startWidth', () => {
    // The regression this pins: a `minmax(240px, 1fr)` column has no pixel
    // width in its definition, so the engine hands the handle a 160px
    // fallback. Anchoring the drag there made the column jump to ~160px on the
    // first pointermove before it began tracking the pointer. Measured, the
    // grab is a no-op until the pointer actually moves.
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness startWidth={160} minWidth={64} onChange={onChange} />);
    const handle = getByTestId('handle');
    handle.setPointerCapture = vi.fn();
    handle.releasePointerCapture = vi.fn();

    // The cell the engine marks with `data-cell-col`, laid out at 420px —
    // jsdom reports every rect as 0x0, so the one number under test is stubbed.
    const cell = handle.closest('[data-cell-col]');
    if (!cell) {
      throw new Error('harness must nest the handle inside a data-cell-col element');
    }
    cell.getBoundingClientRect = () => ({ width: 420.4 }) as DOMRect;

    fireEvent.pointerDown(handle, { clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 500, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(420);

    fireEvent.pointerMove(handle, { clientX: 530, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith(450);

    fireEvent.pointerUp(handle, { clientX: 530, pointerId: 1 });
  });

  it('does nothing when pointerMove fires without a prior pointerDown', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness startWidth={150} onChange={onChange} />);
    fireEvent.pointerMove(getByTestId('handle'), { clientX: 200, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
