import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePanelWidth, usePersistedFlag, type PanelSide } from './index';

afterEach(() => localStorage.clear());

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

describe('usePanelWidth', () => {
  it('starts at the default width', () => {
    render(<Harness />);
    expect(widthOf()).toBe('224px');
  });

  it('names the separator after the panel it resizes', () => {
    render(<Harness />);
    expect(screen.getByRole('separator', { name: 'Resize Test panel' })).toBeInTheDocument();
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
});
