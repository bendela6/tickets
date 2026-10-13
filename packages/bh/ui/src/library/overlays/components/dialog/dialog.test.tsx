import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { Drawer, DrawerControls } from '../drawer';
import { SidePanel } from '../side-panel';
import {
  ConfirmDialog,
  DialogClose,
  DialogContent,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from './dialog';

test('confirm dialog renders title/body and fires onConfirm', async () => {
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={() => {}}
      title="Archive CORE-128?"
      body="Archived tickets leave every view but stay findable."
      confirmLabel="Archive"
      destructive
      onConfirm={onConfirm}
    />,
  );
  expect(screen.getByText('Archive CORE-128?')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
  expect(onConfirm).toHaveBeenCalledOnce();
});

function Opener({ onConfirm = () => {} }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Archive
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Archive this?"
        confirmLabel="Yes, archive"
        onConfirm={onConfirm}
      />
    </>
  );
}

test.each(['Cancel', 'Yes, archive'])(
  'closing by %s returns focus to the button that opened it',
  async (name) => {
    const user = userEvent.setup();
    render(<Opener />);
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveFocus();
  },
);

test('Esc returns focus to the button that opened it too', async () => {
  const user = userEvent.setup();
  render(<Opener />);
  await user.click(screen.getByRole('button', { name: 'Archive' }));
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Archive' })).toHaveFocus();
});

const pressEscape = (user: UserEvent) => user.keyboard('{Escape}');
const pressDone = (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Done' }));

// Opened by `open` from a button of its own, the way an app opens one from a
// row, a menu item or a shortcut; with `trigger`, it has a DialogTrigger too.
function OpenedByState({ trigger = false }: { trigger?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger>Rename</DialogTrigger> : null}
      <button type="button" onClick={() => setOpen(true)}>
        Rename from here
      </button>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Rename file</DialogTitle>
        <DialogClose>Done</DialogClose>
      </DialogContent>
    </DialogRoot>
  );
}

describe('DialogContent gives focus back', () => {
  test.each([
    ['Esc', pressEscape],
    ['its close button', pressDone],
  ])('to the button that opened it, with no DialogTrigger, on %s', async (_how, close) => {
    const user = userEvent.setup();
    render(<OpenedByState />);
    const opener = screen.getByRole('button', { name: 'Rename from here' });
    await user.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await close(user);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  test.each([
    ['Esc', pressEscape],
    ['its close button', pressDone],
  ])('to its DialogTrigger when the trigger opened it, on %s', async (_how, close) => {
    const user = userEvent.setup();
    render(<OpenedByState trigger />);
    const trigger = screen.getByRole('button', { name: 'Rename' });
    await user.click(trigger);
    await close(user);
    expect(trigger).toHaveFocus();
  });

  test('to what opened it rather than its DialogTrigger, when something else did', async () => {
    const user = userEvent.setup();
    render(<OpenedByState trigger />);
    const opener = screen.getByRole('button', { name: 'Rename from here' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });
});

// A list whose rows each open a dialog that can delete the row that opened
// it. The list takes focus (tabIndex -1), as a grid or a listbox would.
function RowsWithDelete({ shape }: { shape: 'confirm' | 'parts' }) {
  const [rows, setRows] = useState(['a.txt', 'b.txt']);
  const [target, setTarget] = useState<string | null>(null);
  const remove = () => setRows((current) => current.filter((row) => row !== target));
  const onOpenChange = (open: boolean) => {
    if (!open) {
      setTarget(null);
    }
  };
  return (
    <>
      <ul aria-label="Files" tabIndex={-1}>
        {rows.map((row) => {
          return (
            <li key={row}>
              <button type="button" onClick={() => setTarget(row)}>
                Delete {row}
              </button>
            </li>
          );
        })}
      </ul>
      {shape === 'confirm' ? (
        <ConfirmDialog
          open={target !== null}
          onOpenChange={onOpenChange}
          title="Delete it?"
          confirmLabel="Delete"
          onConfirm={remove}
        />
      ) : (
        <DialogRoot open={target !== null} onOpenChange={onOpenChange}>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Delete it?</DialogTitle>
            <DialogClose onClick={remove}>Delete</DialogClose>
          </DialogContent>
        </DialogRoot>
      )}
    </>
  );
}

describe('when what opened it has left the page', () => {
  test.each(['confirm', 'parts'] as const)(
    'focus goes to the nearest container of it that takes focus (%s)',
    async (shape) => {
      const user = userEvent.setup();
      render(<RowsWithDelete shape={shape} />);
      await user.click(screen.getByRole('button', { name: 'Delete a.txt' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      expect(screen.queryByRole('button', { name: 'Delete a.txt' })).toBeNull();
      await waitFor(() => expect(screen.getByRole('list', { name: 'Files' })).toHaveFocus());
    },
  );

  test('its DialogTrigger takes focus before that container', async () => {
    function Host() {
      const [shown, setShown] = useState(true);
      const [open, setOpen] = useState(false);
      return (
        <div role="toolbar" aria-label="Tools" tabIndex={-1}>
          <DialogRoot open={open} onOpenChange={setOpen}>
            <DialogTrigger>Rename</DialogTrigger>
            {shown ? (
              <button type="button" onClick={() => setOpen(true)}>
                Rename from here
              </button>
            ) : null}
            <DialogContent aria-describedby={undefined}>
              <DialogTitle>Rename file</DialogTitle>
              <button type="button" onClick={() => setShown(false)}>
                Remove the opener
              </button>
            </DialogContent>
          </DialogRoot>
        </div>
      );
    }
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Rename from here' }));
    await user.click(screen.getByRole('button', { name: 'Remove the opener' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Rename' })).toHaveFocus();
  });

  test('or can no longer take focus, focus goes on to the next place', async () => {
    function Host() {
      const [archived, setArchived] = useState(false);
      const [open, setOpen] = useState(false);
      return (
        <ul aria-label="Files" tabIndex={-1}>
          <li>
            <button type="button" disabled={archived} onClick={() => setOpen(true)}>
              Archive
            </button>
            <ConfirmDialog
              open={open}
              onOpenChange={setOpen}
              title="Archive it?"
              confirmLabel="Yes, archive"
              onConfirm={() => setArchived(true)}
            />
          </li>
        </ul>
      );
    }
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    await user.click(screen.getByRole('button', { name: 'Yes, archive' }));
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('list', { name: 'Files' })).toHaveFocus());
  });
});

describe('opened from inside another surface', () => {
  test('a dialog opened from a side panel gives focus back inside the panel', async () => {
    function Host() {
      const [panelOpen, setPanelOpen] = useState(false);
      const [dialogOpen, setDialogOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setPanelOpen(true)}>
            Filters
          </button>
          <SidePanel
            label="Filters panel"
            collapsible
            collapsedTo="none"
            open={panelOpen}
            onOpenChange={setPanelOpen}
          >
            <button type="button" onClick={() => setDialogOpen(true)}>
              Save filter
            </button>
          </SidePanel>
          <DialogRoot open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent aria-describedby={undefined}>
              <DialogTitle>Name the filter</DialogTitle>
              <DialogClose>Done</DialogClose>
            </DialogContent>
          </DialogRoot>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const save = screen.getByRole('button', { name: 'Save filter' });
    await user.click(save);
    await user.keyboard('{Escape}');
    expect(save).toHaveFocus();
    // Then the panel, hidden from its own button, gives focus to what opened it.
    await user.click(screen.getByRole('button', { name: 'Hide Filters panel' }));
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveFocus();
  });

  test('a dialog that removes its opener inside a drawer gives focus to the drawer', async () => {
    function Host() {
      const [drawerOpen, setDrawerOpen] = useState(false);
      const [confirming, setConfirming] = useState(false);
      const [deleted, setDeleted] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setDrawerOpen(true)}>
            Open item
          </button>
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} label="Item">
            <DrawerControls />
            {deleted ? (
              <p>Deleted</p>
            ) : (
              <button type="button" onClick={() => setConfirming(true)}>
                Delete comment
              </button>
            )}
            <ConfirmDialog
              open={confirming}
              onOpenChange={setConfirming}
              title="Delete the comment?"
              confirmLabel="Delete"
              onConfirm={() => setDeleted(true)}
            />
          </Drawer>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open item' }));
    await user.click(screen.getByRole('button', { name: 'Delete comment' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    // Not <body>, which would leave focus behind the drawer that is still open.
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Item' })).toHaveFocus());
    // The drawer still gives focus back to what opened it.
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Open item' })).toHaveFocus();
  });
});
