import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './app-shell';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: '/', search: {} } }),
}));

// The shell's own layout is under test, not what the panels put inside it.
vi.mock('./activity-rail', () => ({ ActivityRail: () => <div>rail</div> }));
vi.mock('./brand-mark', () => ({ BrandMark: () => <span>mark</span> }));
vi.mock('./mode-panel', () => ({ ModePanel: () => <div>panel body</div> }));

// Several tests fake a viewport; put the setup stub back after each so the
// swap cannot leak into its neighbours.
const realMatchMedia = window.matchMedia;

afterEach(() => {
  localStorage.clear();
  window.matchMedia = realMatchMedia;
});

// Drives the media query the shell watches for "is this a phone", and lets a
// test flip it after mount the way a rotation or a window resize would.
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

const renderShell = () => render(<AppShell><p>content</p></AppShell>);
const dockedWidth = () =>
  (document.querySelector('aside') as HTMLElement).style.getPropertyValue('--panel-w');

describe('AppShell', () => {
  it('docks the navigation in a resizable panel', () => {
    renderShell();
    expect(screen.getByText('panel body')).toBeInTheDocument();
    expect(screen.getByRole('separator', { name: 'Resize Navigation' })).toBeInTheDocument();
    expect(dockedWidth()).toBe('224px');
  });

  it('collapses the navigation and remembers that across a remount', async () => {
    const { unmount } = renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Hide Navigation' }));
    expect(screen.queryByText('panel body')).not.toBeInTheDocument();
    unmount();

    renderShell();
    expect(screen.queryByText('panel body')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show Navigation' }));
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });

  it('remembers a resized width across a remount', () => {
    const { unmount } = renderShell();
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Navigation' }), {
      key: 'ArrowRight',
    });
    expect(dockedWidth()).toBe('248px');
    unmount();

    renderShell();
    expect(dockedWidth()).toBe('248px');
  });

  it('opens the mobile navigation as a dialog that Escape closes', async () => {
    // Esc did nothing here before: the old slide-over was a bare fixed aside.
    mockViewport(true);
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('drops the mobile navigation entirely when the viewport widens past md', async () => {
    // A phone rotating to landscape crosses 768px with the nav still open. A
    // `md:hidden` class would only have hidden the panel: the scrim would stay
    // painted, focus stay trapped, `pointer-events: none` stay on <body> and
    // the app behind stay aria-hidden — a desktop UI that reads as frozen.
    const viewport = mockViewport(true);
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();

    viewport.set(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.pointerEvents).toBe('');
    expect(screen.getByText('content')).toBeVisible();

    // And narrowing again does not spring it back open on its own.
    viewport.set(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
