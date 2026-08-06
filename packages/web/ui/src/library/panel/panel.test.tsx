import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePanelWidth, usePersistedFlag, type PanelSide } from './index';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

// A user with site data blocked (Chrome's "block all cookies", an enterprise
// policy, a sandboxed embed) gets a throw out of every localStorage call, not
// a null — including the read these hooks do inside a `useState` initializer,
// which would take the render down with it.
function blockStorage() {
  const denied = () => {
    throw new DOMException('access denied', 'SecurityError');
  };
  return {
    getItem: vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied),
    setItem: vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied),
  };
}

// A minimal host: the hook needs a real element to measure, and the width is
// read back off the custom property exactly as the real components set it.
function Harness({
  side = 'left',
  storageKey,
  defaultWidth = 224,
}: {
  side?: PanelSide;
  storageKey?: string;
  defaultWidth?: number;
}) {
  const { width, panelRef, separatorProps } = usePanelWidth({
    side,
    defaultWidth,
    minWidth: 180,
    maxWidth: 400,
    storageKey,
    label: 'Test panel',
  });
  return (
    <aside ref={panelRef} data-testid="panel" style={{ ['--panel-w' as string]: `${width}px` }}>
      <div {...separatorProps} />
    </aside>
  );
}

const widthOf = () =>
  screen.getByTestId('panel').style.getPropertyValue('--panel-w');

// jsdom gives every element a zero-size rect, which would make a right-side
// drag always clamp to the minimum and prove nothing. The drag math reads the
// panel's rect fresh on every pointermove, so stubbing it after render is
// enough — no need to route it through the ref or a layout effect.
function stubPanelRect(rect: { left: number; right: number }) {
  const panel = screen.getByTestId('panel');
  panel.getBoundingClientRect = () =>
    ({
      left: rect.left,
      right: rect.right,
      top: 0,
      bottom: 0,
      width: rect.right - rect.left,
      height: 0,
      x: rect.left,
      y: 0,
      toJSON() {},
    }) as DOMRect;
  return panel;
}

describe('usePanelWidth', () => {
  it('starts at the default width', () => {
    render(<Harness />);
    expect(widthOf()).toBe('224px');
  });

  it('names the separator after the panel it resizes', () => {
    render(<Harness />);
    expect(screen.getByRole('separator', { name: 'Resize Test panel' })).toBeInTheDocument();
  });

  it('publishes the width it is dragging as a valid window splitter', () => {
    // A focusable separator is the window-splitter form of the role, and ARIA
    // requires aria-valuenow on it — without one the widget is invalid and a
    // screen-reader user gets no feedback that the arrows did anything.
    render(<Harness />);
    const handle = screen.getByRole('separator', { name: 'Resize Test panel' });
    expect(handle).toHaveAttribute('aria-valuemin', '180');
    expect(handle).toHaveAttribute('aria-valuemax', '400');
    expect(handle).toHaveAttribute('aria-valuenow', '224');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle).toHaveAttribute('aria-valuenow', '248');
  });

  it('degrades to the default width when storage throws, instead of taking the render down', () => {
    const { setItem } = blockStorage();
    render(<Harness storageKey="k" />);
    expect(widthOf()).toBe('224px');

    // The write path is the other half: a quota-exceeded setItem mid-drag
    // would otherwise throw out of the pointerup handler.
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Test panel' }), {
      key: 'ArrowRight',
    });
    expect(widthOf()).toBe('248px');
    expect(setItem).toHaveBeenCalled();
  });

  it('widens a left panel with ArrowRight and narrows it with ArrowLeft', () => {
    render(<Harness side="left" />);
    const handle = screen.getByRole('separator', { name: 'Resize Test panel' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(widthOf()).toBe('248px');
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(widthOf()).toBe('200px');
  });

  it('mirrors the keys for a right panel, where wider means leftward', () => {
    render(<Harness side="right" />);
    const handle = screen.getByRole('separator', { name: 'Resize Test panel' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(widthOf()).toBe('248px');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(widthOf()).toBe('224px');
  });

  it('clamps at both ends', () => {
    render(<Harness defaultWidth={190} />);
    const handle = screen.getByRole('separator', { name: 'Resize Test panel' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(widthOf()).toBe('180px');
    for (let i = 0; i < 20; i += 1) fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(widthOf()).toBe('400px');
  });

  it('clamps a stored width that no longer fits the current bounds', () => {
    localStorage.setItem('k', '5000');
    render(<Harness storageKey="k" />);
    expect(widthOf()).toBe('400px');
  });

  it('restores a stored width over the default, and ignores a corrupt one', () => {
    localStorage.setItem('k', '300');
    const { unmount } = render(<Harness storageKey="k" />);
    expect(widthOf()).toBe('300px');
    unmount();
    localStorage.setItem('k', 'not-a-number');
    render(<Harness storageKey="k" />);
    expect(widthOf()).toBe('224px');
  });

  it('persists only when a storageKey is given', () => {
    const { unmount } = render(<Harness />);
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Test panel' }), {
      key: 'ArrowRight',
    });
    expect(localStorage.length).toBe(0);
    unmount();

    render(<Harness storageKey="k" />);
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Test panel' }), {
      key: 'ArrowRight',
    });
    expect(localStorage.getItem('k')).toBe('248');
  });
});

describe('usePanelWidth dragging', () => {
  // The hook attaches its pointermove/pointerup listeners to the handle
  // itself (for pointer capture), not to window, so the gesture must be
  // fired at the handle, not dispatched globally.
  it('drags a left panel by clientX - rect.left, and a right panel by rect.right - clientX — opposite directions for the same motion', () => {
    const { unmount } = render(<Harness side="left" />);
    stubPanelRect({ left: 0, right: 224 });
    let handle = screen.getByRole('separator', { name: 'Resize Test panel' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 224 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 244 });
    expect(widthOf()).toBe('244px');
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 244 });
    unmount();

    render(<Harness side="right" />);
    stubPanelRect({ left: 800, right: 1024 });
    handle = screen.getByRole('separator', { name: 'Resize Test panel' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 800 });
    // The same rightward pointer motion (+20) that widened the left panel
    // above narrows this one, because a right panel's inner (draggable) edge
    // is its left edge: moving right shrinks the gap to rect.right.
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 820 });
    expect(widthOf()).toBe('204px');
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 820 });
  });

  it('clamps a drag at both ends', () => {
    render(<Harness side="left" />);
    stubPanelRect({ left: 0, right: 224 });
    const handle = screen.getByRole('separator', { name: 'Resize Test panel' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 224 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: -50 });
    expect(widthOf()).toBe('180px');
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 1000 });
    expect(widthOf()).toBe('400px');
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 1000 });
  });

  it('stops resizing once the pointer is released', () => {
    render(<Harness side="left" />);
    stubPanelRect({ left: 0, right: 224 });
    const handle = screen.getByRole('separator', { name: 'Resize Test panel' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 224 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300 });
    expect(widthOf()).toBe('300px');
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 300 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 350 });
    expect(widthOf()).toBe('300px');
  });

  it('persists the dragged width only when a storageKey is given, and restores it on remount', () => {
    const { unmount } = render(<Harness side="left" storageKey="k" />);
    stubPanelRect({ left: 0, right: 224 });
    const handle = screen.getByRole('separator', { name: 'Resize Test panel' });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 224 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 260 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 260 });
    expect(localStorage.getItem('k')).toBe('260');
    unmount();

    render(<Harness side="left" storageKey="k" />);
    expect(widthOf()).toBe('260px');
  });
});

describe('usePersistedFlag', () => {
  function FlagHarness({ storageKey, fallback }: { storageKey?: string; fallback: boolean }) {
    const [on, setOn] = usePersistedFlag(storageKey, fallback);
    return (
      <button type="button" onClick={() => setOn(!on)}>
        {on ? 'on' : 'off'}
      </button>
    );
  }

  it('falls back when nothing is stored, and round-trips both booleans', () => {
    const { unmount } = render(<FlagHarness storageKey="f" fallback={false} />);
    expect(screen.getByRole('button')).toHaveTextContent('off');
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem('f')).toBe('true');
    unmount();

    render(<FlagHarness storageKey="f" fallback={false} />);
    expect(screen.getByRole('button')).toHaveTextContent('on');
  });

  it('treats a stored false as a real choice, not as unset', () => {
    // The distinction matters: a panel whose default is open must stay closed
    // for a user who deliberately closed it.
    localStorage.setItem('f', 'false');
    render(<FlagHarness storageKey="f" fallback />);
    expect(screen.getByRole('button')).toHaveTextContent('off');
  });

  it('ignores an unrecognised stored value and uses the fallback', () => {
    localStorage.setItem('f', 'yes');
    render(<FlagHarness storageKey="f" fallback />);
    expect(screen.getByRole('button')).toHaveTextContent('on');
  });

  it('falls back and keeps toggling when storage throws', () => {
    const { setItem } = blockStorage();
    render(<FlagHarness storageKey="f" fallback />);
    expect(screen.getByRole('button')).toHaveTextContent('on');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('off');
    expect(setItem).toHaveBeenCalled();
  });
});
