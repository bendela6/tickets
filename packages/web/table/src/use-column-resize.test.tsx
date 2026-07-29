/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useColumnResize } from './use-column-resize';

afterEach(cleanup);

function Harness(props: { startWidth: number; minWidth?: number; onChange: (px: number) => void }) {
  const handlers = useColumnResize(props);
  return <div role="separator" data-testid="handle" {...handlers} />;
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

  it('does nothing when pointerMove fires without a prior pointerDown', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<Harness startWidth={150} onChange={onChange} />);
    fireEvent.pointerMove(getByTestId('handle'), { clientX: 200, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
