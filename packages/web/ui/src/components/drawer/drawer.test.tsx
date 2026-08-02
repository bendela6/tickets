import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Drawer, DrawerControls } from './drawer';

// One test swaps matchMedia to fake a phone; put the setup stub back after each
// so the swap cannot leak into its neighbours.
const realMatchMedia = window.matchMedia;

afterEach(() => {
  localStorage.clear();
  window.matchMedia = realMatchMedia;
});

function Host({
  side = 'right',
  storageKey,
  maximizable = false,
}: {
  side?: 'left' | 'right';
  storageKey?: string;
  maximizable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open it
      </button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        side={side}
        size="lg"
        storageKey={storageKey}
        maximizable={maximizable}
        label="Detail"
      >
        <DrawerControls />
        <p>Body text</p>
      </Drawer>
    </>
  );
}

const panel = () => screen.getByRole('dialog', { name: 'Detail' });
const widthOf = () => panel().style.getPropertyValue('--panel-w');

describe('Drawer', () => {
  it('opens on demand and names itself for assistive tech', async () => {
    render(<Host />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(panel()).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on the close control and returns focus to the trigger', async () => {
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Open it' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('caps its width at the viewport minus a 48px tap strip', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    // size="lg" is 620px; the cap is expressed in CSS so both bounds survive a
    // resize without JS re-measuring.
    expect(widthOf()).toBe('min(620px, 100vw - 3rem)');
  });

  it('resizes by keyboard, mirrored for the side it is docked to', async () => {
    render(<Host side="right" />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Detail' }), {
      key: 'ArrowLeft',
    });
    expect(widthOf()).toBe('min(644px, 100vw - 3rem)');
  });

  it('hides the maximize control unless asked for it', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(screen.queryByRole('button', { name: 'Maximize' })).not.toBeInTheDocument();
  });

  it('maximizes to full width and restores the dragged width, not the default', async () => {
    render(<Host maximizable />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Detail' }), {
      key: 'ArrowLeft',
    });
    expect(widthOf()).toBe('min(644px, 100vw - 3rem)');

    await userEvent.click(screen.getByRole('button', { name: 'Maximize' }));
    expect(widthOf()).toBe('calc(100vw - 3rem)');
    // The resize handle is meaningless while maximized.
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(widthOf()).toBe('min(644px, 100vw - 3rem)');
  });

  it('remembers width and maximized state under a storageKey', async () => {
    const { unmount } = render(<Host maximizable storageKey="d" />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Detail' }), {
      key: 'ArrowLeft',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Maximize' }));
    unmount();

    render(<Host maximizable storageKey="d" />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(widthOf()).toBe('min(644px, 100vw - 3rem)');
  });

  it('drops the resize handle when the viewport cannot fit the minimum width', async () => {
    // A phone is already showing the drawer at full width; there is no room
    // left to drag it into.
    window.matchMedia = ((media: string) => ({
      matches: true,
      media,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('refuses to render controls outside a Drawer', () => {
    // Rendering the controls loose would silently do nothing; failing loudly is
    // the difference between a caught mistake and a dead button.
    expect(() => render(<DrawerControls />)).toThrow(/within a Drawer/i);
  });
});
