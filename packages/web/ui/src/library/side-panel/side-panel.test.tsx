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
  window.matchMedia = ((media: string) => ({
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
  })) as unknown as typeof window.matchMedia;
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
    // jsdom gives every element a zero rect, so a left panel's width is read
    // straight off clientX.
    fireEvent.pointerDown(handle, { pointerId: 1 });
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
});
