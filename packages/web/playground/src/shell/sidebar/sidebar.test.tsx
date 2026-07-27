import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { collectDemos, isDemoError, type CollectedDemo } from '@tickets/ui';
import { clampWidth, Sidebar, SIDEBAR_MAX, SIDEBAR_MIN } from './sidebar';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

const demos = collectDemos({
  a: { meta: { title: 'Button', group: 'Form controls' }, states: [{ name: 's', render: () => null }] },
  b: { meta: { title: 'Input', group: 'Form controls' }, states: [{ name: 's', render: () => null }] },
  c: { meta: { title: 'Pill', group: 'Display' }, states: [{ name: 's', render: () => null }] },
}).filter((d): d is LiveDemo => !isDemoError(d));

const linkProps = (target: { slug?: string | null }) => ({
  href: target.slug ? `/gallery/${target.slug}` : '/gallery',
  onClick: () => {},
});

// Drives the media query the sidebar watches, and lets a test flip it after
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

function renderSidebar() {
  return render(
    <Sidebar demos={demos} selected={null} linkProps={linkProps} onOpenPalette={() => {}} />,
  );
}

const aside = () => document.querySelector('aside');

describe('Sidebar', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('lists every component, grouped, with real hrefs', () => {
    mockViewport(false);
    renderSidebar();
    expect(screen.getByRole('link', { name: 'All' }).getAttribute('href')).toBe('/gallery');
    expect(screen.getByRole('link', { name: 'Button' }).getAttribute('href')).toBe(
      '/gallery/button',
    );
    expect(screen.getByText('Form controls')).toBeTruthy();
    expect(screen.getByText('Display')).toBeTruthy();
  });

  it('filters the list without dropping its groups', () => {
    mockViewport(false);
    renderSidebar();
    fireEvent.change(screen.getByPlaceholderText('Filter components…'), {
      target: { value: 'butt' },
    });
    expect(screen.getByRole('link', { name: 'Button' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Input' })).toBeNull();
    // A group with nothing left in it goes too.
    expect(screen.queryByText('Display')).toBeNull();
  });

  it('collapses to a button that costs the content no width, and remembers it', () => {
    mockViewport(false);
    const { unmount } = renderSidebar();

    fireEvent.click(screen.getByRole('button', { name: 'Hide component list' }));
    const opener = screen.getByRole('button', { name: 'Show component list' });
    expect(opener.getAttribute('aria-expanded')).toBe('false');
    expect(opener.className).toContain('fixed');
    expect(aside()).toBeNull();
    expect(localStorage.getItem('gallery-sidebar-collapsed')).toBe('true');

    // The preference survives a remount.
    unmount();
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Show component list' })).toBeTruthy();
  });

  it('starts collapsed on a narrow window, whatever the stored preference', () => {
    localStorage.setItem('gallery-sidebar-collapsed', 'false');
    mockViewport(true);
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Show component list' })).toBeTruthy();
  });

  it('overlays the content instead of pushing it when reopened on a narrow window', () => {
    mockViewport(true);
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Show component list' }));

    // fixed (not sticky/in-flow) plus a scrim over the page behind it.
    expect(aside()!.className).toContain('fixed');
    expect(aside()!.className).not.toContain('sticky');
    expect(document.querySelector('[aria-hidden]')).toBeTruthy();
  });

  it('does not persist a temporary peek on a narrow window', () => {
    mockViewport(true);
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Show component list' }));
    expect(localStorage.getItem('gallery-sidebar-collapsed')).toBeNull();
  });

  it('closes itself when the window becomes narrow and reopens when it widens back', () => {
    const viewport = mockViewport(false);
    renderSidebar();
    expect(aside()).toBeTruthy();

    viewport.set(true);
    expect(screen.getByRole('button', { name: 'Show component list' })).toBeTruthy();

    viewport.set(false);
    expect(aside()).toBeTruthy();
  });

  it('keeps every truncating item unshrinkable in the scrolling column', () => {
    mockViewport(false);
    renderSidebar();
    // `truncate` sets overflow:hidden, which drops a flex item's automatic
    // minimum size to zero — so in an overflowing column the browser crushes
    // it (measured: the All link rendered 8px tall instead of 28). Every
    // truncating item has to opt out of shrinking.
    for (const el of aside()!.querySelectorAll('.truncate')) {
      const row = el.className.includes('rounded-md') ? el : el.parentElement!;
      expect(row.className).toContain('shrink-0');
    }
  });

  it('scrolls vertically only, with themed scrollbars and truncated names', () => {
    mockViewport(false);
    renderSidebar();
    const nav = aside()!.querySelector('nav')!;
    expect(nav.className).toContain('overflow-y-auto');
    expect(nav.className).toContain('overflow-x-hidden');
    expect(nav.className).toContain('pg-scroll');
    // A long component name ellipsizes rather than widening the sidebar.
    expect(screen.getByRole('link', { name: 'Button' }).className).toContain('truncate');
  });

  it('restores a persisted width, clamped to the allowed range', () => {
    mockViewport(false);
    localStorage.setItem('gallery-sidebar', JSON.stringify({ width: 9999 }));
    renderSidebar();
    expect(aside()!.getAttribute('style')).toContain(`--sidebar-width: ${SIDEBAR_MAX}px`);
  });

  it('offers a resize handle', () => {
    mockViewport(false);
    renderSidebar();
    const handle = screen.getByRole('separator', { name: 'Resize component list' });
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.className).toContain('cursor-col-resize');
  });
});

describe('clampWidth', () => {
  it('holds the sidebar between its min and max', () => {
    expect(clampWidth(10)).toBe(SIDEBAR_MIN);
    expect(clampWidth(9999)).toBe(SIDEBAR_MAX);
    expect(clampWidth(260)).toBe(260);
  });

  it('has a range wide enough to be worth dragging', () => {
    expect(SIDEBAR_MAX - SIDEBAR_MIN).toBeGreaterThan(100);
  });
});

describe('Sidebar palette hook-up', () => {
  it('opens the palette from the ⌘K chip', () => {
    mockViewport(false);
    const onOpenPalette = vi.fn();
    render(
      <Sidebar demos={demos} selected={null} linkProps={linkProps} onOpenPalette={onOpenPalette} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '⌘K' }));
    expect(onOpenPalette).toHaveBeenCalled();
  });
});
