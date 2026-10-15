import { StrictMode, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { SidePanel } from './side-panel';

// Several tests swap matchMedia to fake a viewport; put the setup stub back
// after each so the swap cannot leak into its neighbours.
const realMatchMedia = window.matchMedia;

afterEach(() => {
  localStorage.clear();
  window.matchMedia = realMatchMedia;
});

// Drives the media query SidePanel watches, and lets a test flip it after
// mount the way a real window resize would.
function mockViewport(initiallyNarrow: boolean) {
  const listeners = new Set<() => void>();
  let narrow = initiallyNarrow;
  window.matchMedia = ((media: string) => {
    return {
      get matches() {
        return narrow;
      },
      media,
      onchange: null,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  }) as unknown as typeof window.matchMedia;
  return {
    // The media-query callback fires outside React's event system, so the
    // resulting state update has to be flushed explicitly.
    set(next: boolean) {
      narrow = next;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

function renderPanel(props: Partial<React.ComponentProps<typeof SidePanel>> = {}) {
  return render(
    <SidePanel label="Navigation" defaultWidth={224} minWidth={180} maxWidth={400} {...props}>
      <p>Panel body</p>
    </SidePanel>,
  );
}

const aside = () => document.querySelector('aside') as HTMLElement;

describe('SidePanel', () => {
  it('renders its children at the default width', () => {
    mockViewport(false);
    renderPanel();
    expect(screen.getByText('Panel body')).toBeInTheDocument();
    expect(aside().style.getPropertyValue('--panel-w')).toBe('224px');
  });

  it('is not a dialog — it holds a column and never traps focus', () => {
    mockViewport(false);
    renderPanel();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Navigation' })).toBeInTheDocument();
  });

  it('drags to a new width, clamped at both ends', () => {
    mockViewport(false);
    renderPanel();
    const handle = screen.getByRole('separator', { name: 'Resize Navigation' });
    // A left panel's handle is its right edge, 224 pixels in, where a press
    // lands; a drag moves the width by as far as the pointer goes. jsdom lays
    // nothing out, so the drag starts from the width the panel holds.
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 224 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300 });
    expect(aside().style.getPropertyValue('--panel-w')).toBe('300px');
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 5000 });
    expect(aside().style.getPropertyValue('--panel-w')).toBe('400px');
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 10 });
    expect(aside().style.getPropertyValue('--panel-w')).toBe('180px');

    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 350 });
    expect(aside().style.getPropertyValue('--panel-w')).toBe('180px');
  });

  it('collapses to a reopen rail and back', async () => {
    mockViewport(false);
    renderPanel({ collapsible: true, collapsedTo: 'rail' });
    await userEvent.click(screen.getByRole('button', { name: 'Hide Navigation' }));
    expect(screen.queryByText('Panel body')).not.toBeInTheDocument();

    const reopen = screen.getByRole('button', { name: 'Show Navigation' });
    expect(reopen).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(reopen);
    expect(screen.getByText('Panel body')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show Navigation' })).not.toBeInTheDocument();
  });

  it('collapses to a floating button that costs the page no column', async () => {
    mockViewport(false);
    renderPanel({ collapsible: true, collapsedTo: 'edge' });
    await userEvent.click(screen.getByRole('button', { name: 'Hide Navigation' }));
    // No aside at all — the layout reclaims the whole column, which is the
    // difference between this and collapsedTo="rail".
    expect(document.querySelector('aside')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show Navigation' })).toBeInTheDocument();
  });

  it('remembers width and collapsed state under a storageKey', async () => {
    mockViewport(false);
    const { unmount } = renderPanel({ collapsible: true, storageKey: 'nav' });
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Navigation' }), {
      key: 'ArrowRight',
    });
    expect(aside().style.getPropertyValue('--panel-w')).toBe('248px');
    await userEvent.click(screen.getByRole('button', { name: 'Hide Navigation' }));
    unmount();

    renderPanel({ collapsible: true, storageKey: 'nav' });
    await userEvent.click(screen.getByRole('button', { name: 'Show Navigation' }));
    expect(aside().style.getPropertyValue('--panel-w')).toBe('248px');
  });

  it('stays docked at every width unless overlayBelow is given', () => {
    mockViewport(true);
    renderPanel({ collapsible: true });
    expect(screen.getByText('Panel body')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reopens as a Drawer below the breakpoint when opted in', async () => {
    mockViewport(true);
    renderPanel({ collapsible: true, overlayBelow: 'lg' });
    // A narrow window forces it shut rather than squeezing the content.
    expect(screen.queryByText('Panel body')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show Navigation' }));
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
    expect(screen.getByText('Panel body')).toBeInTheDocument();
  });

  it('restores the docked panel when the window widens again', () => {
    const viewport = mockViewport(true);
    renderPanel({ collapsible: true, overlayBelow: 'lg' });
    expect(screen.queryByText('Panel body')).not.toBeInTheDocument();
    viewport.set(false);
    expect(screen.getByText('Panel body')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shuts the overlay when the window narrows again, rather than reopening it unprompted', async () => {
    const viewport = mockViewport(true);
    renderPanel({ collapsible: true, overlayBelow: 'lg' });
    await userEvent.click(screen.getByRole('button', { name: 'Show Navigation' }));
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();

    viewport.set(false);
    expect(screen.getByText('Panel body')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    viewport.set(true);
    // No dialog and no gesture from the user — a widen/narrow cycle must not
    // pop the overlay back open on its own.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Panel body')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Navigation' })).toBeInTheDocument();
  });

  it('below the breakpoint, puts its button where it docks, clear of a bar above the page', () => {
    mockViewport(true);
    // A frame's bar above the page, as AppShell's is on a phone, and the
    // page's row the panel docks in.
    render(
      <>
        <header>Top bar</header>
        <div data-testid="row">
          <SidePanel label="Navigation" collapsible overlayBelow="md">
            <p>Panel body</p>
          </SidePanel>
          <div>Content</div>
        </div>
      </>,
    );
    const show = screen.getByRole('button', { name: 'Show Navigation' });
    // jsdom lays nothing out, so this holds what the browser draws from it:
    // the button floats over its own place in the row, which comes after the
    // bar, not over the window, whose top the bar holds.
    expect(show).not.toHaveClass('fixed');
    expect(show).toHaveClass('absolute');
    const place = show.parentElement;
    expect(place).toHaveClass('relative', 'w-0');
    expect(place?.parentElement).toBe(screen.getByTestId('row'));
  });

  it('draws no reopen button when the page opens it from its own, and keeps the rail', async () => {
    const viewport = mockViewport(true);
    renderPanel({ collapsible: true, overlayBelow: 'md', reopenButton: false });
    expect(screen.queryByRole('button', { name: 'Show Navigation' })).toBeNull();

    // Docked, the rail is the panel's own and stays.
    viewport.set(false);
    await userEvent.click(screen.getByRole('button', { name: 'Hide Navigation' }));
    expect(screen.getByRole('button', { name: 'Show Navigation' })).toBeInTheDocument();
  });

  it('draws no floating button at the edge either, without one', async () => {
    mockViewport(false);
    renderPanel({ collapsible: true, collapsedTo: 'edge', reopenButton: false });
    await userEvent.click(screen.getByRole('button', { name: 'Hide Navigation' }));
    expect(screen.queryByRole('button', { name: 'Show Navigation' })).toBeNull();
  });
});

describe('SidePanel — controlled', () => {
  function Controlled({ narrow }: { narrow: boolean }) {
    const [open, setOpen] = useState(false);
    mockViewport(narrow);
    return (
      <>
        <button type="button" onClick={() => setOpen(!open)}>
          Filters
        </button>
        <SidePanel
          label="Filters panel"
          side="right"
          collapsible
          collapsedTo="none"
          overlayBelow="lg"
          open={open}
          onOpenChange={setOpen}
        >
          <p>Panel body</p>
        </SidePanel>
      </>
    );
  }

  it('opens from a control elsewhere, and shuts from its own toggle', async () => {
    render(<Controlled narrow={false} />);
    // Shut, it leaves nothing behind: the page's own button is the way back.
    expect(document.querySelector('aside')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show Filters panel' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByText('Panel body')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hide Filters panel' }));
    expect(screen.queryByText('Panel body')).not.toBeInTheDocument();
  });

  it('opens as an overlay below the breakpoint, from the same control', async () => {
    render(<Controlled narrow />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Panel body');
  });

  it('gives focus back to the control that opened it, when hidden from its own button', async () => {
    const user = userEvent.setup();
    render(<Controlled narrow={false} />);
    const filters = screen.getByRole('button', { name: 'Filters' });
    await user.click(filters);
    await user.click(screen.getByRole('button', { name: 'Hide Filters panel' }));
    expect(screen.queryByText('Panel body')).not.toBeInTheDocument();
    expect(filters).toHaveFocus();
  });

  it('gives focus back to that control below the breakpoint too, on Esc', async () => {
    const user = userEvent.setup();
    render(<Controlled narrow />);
    const filters = screen.getByRole('button', { name: 'Filters' });
    await user.click(filters);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(filters).toHaveFocus();
  });

  it('gives focus back to that control when a field in it took focus with autoFocus', async () => {
    function WithSearch() {
      const [open, setOpen] = useState(false);
      mockViewport(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Filters
          </button>
          <SidePanel
            label="Filters panel"
            collapsible
            collapsedTo="none"
            open={open}
            onOpenChange={setOpen}
          >
            <input aria-label="Find a filter" autoFocus />
          </SidePanel>
        </>
      );
    }
    const user = userEvent.setup();
    render(<WithSearch />);
    const filters = screen.getByRole('button', { name: 'Filters' });
    await user.click(filters);
    expect(screen.getByRole('textbox', { name: 'Find a filter' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Hide Filters panel' }));
    expect(filters).toHaveFocus();
  });

  it('leaves focus where it is when it closes while focus is elsewhere', async () => {
    function ClosedFromContent() {
      const [open, setOpen] = useState(true);
      mockViewport(false);
      return (
        <>
          <input
            aria-label="Search"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setOpen(false);
              }
            }}
          />
          <SidePanel label="Filters panel" collapsible open={open} onOpenChange={setOpen}>
            <p>Panel body</p>
          </SidePanel>
        </>
      );
    }
    const user = userEvent.setup();
    render(<ClosedFromContent />);
    const search = screen.getByRole('textbox', { name: 'Search' });
    await user.click(search);
    await user.keyboard('{Enter}');
    expect(screen.queryByText('Panel body')).not.toBeInTheDocument();
    expect(search).toHaveFocus();
  });

  it('gives focus to its own way back when the control that opened it has gone', async () => {
    function OpenerGoes() {
      const [open, setOpen] = useState(false);
      const [shown, setShown] = useState(true);
      mockViewport(false);
      return (
        <>
          {shown ? (
            <button type="button" onClick={() => setOpen(true)}>
              Filters
            </button>
          ) : null}
          <SidePanel
            label="Filters panel"
            collapsible
            collapsedTo="edge"
            open={open}
            onOpenChange={setOpen}
          >
            <button type="button" onClick={() => setShown(false)}>
              Remove the opener
            </button>
          </SidePanel>
        </>
      );
    }
    const user = userEvent.setup();
    render(<OpenerGoes />);
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByRole('button', { name: 'Remove the opener' }));
    await user.click(screen.getByRole('button', { name: 'Hide Filters panel' }));
    expect(screen.getByRole('button', { name: 'Show Filters panel' })).toHaveFocus();
  });
});

describe('SidePanel — where focus goes when it is hidden', () => {
  it.each(['rail', 'edge'] as const)(
    'to the button that brings it back, collapsed to the %s',
    async (collapsedTo) => {
      mockViewport(false);
      const user = userEvent.setup();
      renderPanel({ collapsible: true, collapsedTo });
      await user.click(screen.getByRole('button', { name: 'Hide Navigation' }));
      expect(screen.getByRole('button', { name: 'Show Navigation' })).toHaveFocus();
      // And again after it was brought back from that button.
      await user.click(screen.getByRole('button', { name: 'Show Navigation' }));
      await user.click(screen.getByRole('button', { name: 'Hide Navigation' }));
      expect(screen.getByRole('button', { name: 'Show Navigation' })).toHaveFocus();
    },
  );

  it('not to what had focus as the page laid it out open, which did not open it', async () => {
    function Page() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setShown(true)}>
            Go to the page
          </button>
          {shown ? (
            <SidePanel label="Navigation" collapsible>
              <p>Panel body</p>
            </SidePanel>
          ) : null}
        </>
      );
    }
    mockViewport(false);
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Go to the page' }));
    await user.click(screen.getByRole('button', { name: 'Hide Navigation' }));
    expect(screen.getByRole('button', { name: 'Show Navigation' })).toHaveFocus();
  });

  it('nowhere while nothing had focus: it never takes focus as it mounts, in StrictMode', async () => {
    // StrictMode runs effects twice as a component mounts, as if it unmounted
    // between. With the window narrow, the button that opens the drawer is on
    // the page by then, and focus is on nothing; the panel must not take it.
    mockViewport(true);
    render(
      <StrictMode>
        <SidePanel label="Navigation" collapsible overlayBelow="lg">
          <p>Panel body</p>
        </SidePanel>
      </StrictMode>,
    );
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Show Navigation' })).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it('nowhere while nothing had focus: closed by the app, it leaves focus alone', () => {
    mockViewport(false);
    const { rerender } = render(
      <SidePanel label="Navigation" collapsible open onOpenChange={() => {}}>
        <p>Panel body</p>
      </SidePanel>,
    );
    rerender(
      <SidePanel label="Navigation" collapsible open={false} onOpenChange={() => {}}>
        <p>Panel body</p>
      </SidePanel>,
    );
    expect(screen.getByRole('button', { name: 'Show Navigation' })).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it('below the breakpoint, to the button that opened the drawer, on Esc', async () => {
    mockViewport(true);
    const user = userEvent.setup();
    renderPanel({ collapsible: true, overlayBelow: 'lg' });
    const show = screen.getByRole('button', { name: 'Show Navigation' });
    await user.click(show);
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(show).toHaveFocus();
  });
});
