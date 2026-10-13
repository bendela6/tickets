import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfirmDialog } from '../dialog';
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

// Mirrors the Task 4 call site: `<Drawer open>` is a literal constant, and the
// whole component is mounted when a row is selected and unmounted again on
// close — there is never a false→true transition of the `open` prop itself.
function MountedOpenHost() {
  const [mounted, setMounted] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setMounted(true)}>
        Row
      </button>
      {mounted && (
        <Drawer open onOpenChange={() => setMounted(false)} side="right" size="lg" label="Detail">
          <DrawerControls />
          <p>Body text</p>
        </Drawer>
      )}
    </>
  );
}

// Mirrors a master-detail call site: one open Drawer instance whose `label`
// and `children` are swapped by a link inside the panel itself, the way
// ItemDetail's `onOpenItem` would.
function ContentSwapHost() {
  const [open, setOpen] = useState(false);
  const [which, setWhich] = useState<'a' | 'b'>('a');
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open it
      </button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        side="right"
        size="lg"
        label={which === 'a' ? 'Detail A' : 'Detail B'}
      >
        <DrawerControls />
        <button type="button" onClick={() => setWhich('b')}>
          Go to B
        </button>
        <p>{which}</p>
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

  it('restores focus to the opener even when the drawer mounts already open', async () => {
    // No false→true transition of `open` here: the trigger click mounts the
    // whole <Drawer open> instance, exactly as the row-select call site does.
    render(<MountedOpenHost />);
    const trigger = screen.getByRole('button', { name: 'Row' });
    await userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Detail' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps the original opener as the restore target across an in-drawer content swap', async () => {
    render(<ContentSwapHost />);
    const trigger = screen.getByRole('button', { name: 'Open it' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'Go to B' }));
    // The swap landed — same open Drawer instance, new content underneath it.
    expect(screen.getByRole('dialog', { name: 'Detail B' })).toBeInTheDocument();
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
    window.matchMedia = (media: string) => {
      return {
        matches: true,
        media,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      };
    };
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('is modal: it takes pointer events off the page behind it, and gives them back on close', async () => {
    // The scroll lock and focus trap are the visible half of `modal`; this is
    // the half that bites call sites. Anything mounted outside the drawer's
    // portal — a popover a library appends to <body> — is dead to the pointer
    // until it claims `pointer-events: auto` back for itself.
    render(<Host />);
    expect(document.body.style.pointerEvents).toBe('');
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(document.body.style.pointerEvents).toBe('none');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.pointerEvents).toBe('');
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Open it' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('returns focus to the opener when its content takes focus with autoFocus', async () => {
    function AutoFocusHost() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Search
          </button>
          <Drawer open={open} onOpenChange={setOpen} label="Search">
            <input aria-label="Query" autoFocus />
          </Drawer>
        </>
      );
    }
    const user = userEvent.setup();
    render(<AutoFocusHost />);
    const opener = screen.getByRole('button', { name: 'Search' });
    await user.click(opener);
    expect(screen.getByRole('textbox', { name: 'Query' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });

  // Rows in a list that takes focus, as a grid or a listbox does; each row
  // opens the drawer, which can delete the row or archive it.
  function RowsHost() {
    const [rows, setRows] = useState(['CORE-1', 'CORE-2']);
    const [archived, setArchived] = useState<string[]>([]);
    const [open, setOpen] = useState<string | null>(null);
    return (
      <>
        <ul aria-label="Items" tabIndex={-1}>
          {rows.map((row) => {
            return (
              <li key={row}>
                <button
                  type="button"
                  disabled={archived.includes(row)}
                  onClick={() => setOpen(row)}
                >
                  {row}
                </button>
              </li>
            );
          })}
        </ul>
        <Drawer open={open !== null} onOpenChange={() => setOpen(null)} label="Detail">
          <DrawerControls />
          <button type="button" onClick={() => setRows(rows.filter((row) => row !== open))}>
            Delete item
          </button>
          <button type="button" onClick={() => setArchived([...archived, open ?? ''])}>
            Archive item
          </button>
        </Drawer>
      </>
    );
  }

  it.each([
    ['has left the page', 'Delete item'],
    ['can no longer take focus', 'Archive item'],
  ])('gives focus to the nearest container of the opener when it %s', async (_why, action) => {
    const user = userEvent.setup();
    render(<RowsHost />);
    await user.click(screen.getByRole('button', { name: 'CORE-1' }));
    await user.click(screen.getByRole('button', { name: action }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('list', { name: 'Items' })).toHaveFocus());
  });

  it('takes focus back from a dialog opened inside it, then gives it to its own opener', async () => {
    function NestedHost() {
      const [open, setOpen] = useState(false);
      const [asking, setAsking] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open it
          </button>
          <Drawer open={open} onOpenChange={setOpen} label="Detail">
            <DrawerControls />
            <button type="button" onClick={() => setAsking(true)}>
              Archive
            </button>
            <ConfirmDialog
              open={asking}
              onOpenChange={setAsking}
              title="Archive it?"
              onConfirm={() => {}}
            />
          </Drawer>
        </>
      );
    }
    const user = userEvent.setup();
    render(<NestedHost />);
    await user.click(screen.getByRole('button', { name: 'Open it' }));
    const archive = screen.getByRole('button', { name: 'Archive' });
    await user.click(archive);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Detail' })).toBeInTheDocument();
    expect(archive).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Open it' })).toHaveFocus();
  });

  it('refuses to render controls outside a Drawer', () => {
    // Rendering the controls loose would silently do nothing; failing loudly is
    // the difference between a caught mistake and a dead button.
    expect(() => render(<DrawerControls />)).toThrow(/within a Drawer/i);
  });
});
