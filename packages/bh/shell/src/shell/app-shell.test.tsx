// The frame over a small made-up app: the sidebar lists every destination and
// marks the current one, collapsing swaps the rows for the rail and back, the
// footer slot is told which state it is in, the shortcut reopens the sidebar,
// a phone gets the top bar and a drawer whose control closes it, and an app
// with a search of its own has it opened from the field, the rail, the phone's
// bar and the shortcut.

import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Box, Inbox, LayoutDashboard, Settings, Sparkles } from 'lucide-react';
import { TooltipProvider } from '@bh/ui';
import type { NavSection } from '../nav';
import { setNarrowViewport } from '../test/viewport';
import { AppShell } from './app-shell';

vi.mock('@tanstack/react-router', () => {
  return {
    Link: ({
      to,
      children,
      activeOptions: _activeOptions,
      ...rest
    }: {
      to: string;
      children: ReactNode;
      activeOptions?: unknown;
    }) => {
      return (
        <a href={to} {...rest}>
          {children}
        </a>
      );
    },
    useRouterState: ({
      select,
    }: {
      select: (state: { location: { pathname: string } }) => unknown;
    }) => {
      return select({ location: { pathname: '/boxes/7' } });
    },
  };
});

const SECTIONS: readonly NavSection[] = [
  { id: 'home', items: [{ label: 'Home', path: '/', icon: LayoutDashboard }] },
  {
    id: 'things',
    label: 'Things',
    items: [
      { label: 'Boxes', path: '/boxes', icon: Box },
      { label: 'Inbox', path: '/inbox', icon: Inbox },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [{ label: 'Settings', path: '/settings', icon: Settings }],
  },
];

const BRAND = {
  mark: <Sparkles size={18} aria-hidden />,
  name: 'acme',
  caption: <span>the caption</span>,
};

function renderShell(onSearch?: () => void) {
  return render(
    <TooltipProvider>
      <AppShell
        sections={SECTIONS}
        brand={BRAND}
        storagePrefix="test-nav"
        footer={(collapsed) => <div>{collapsed ? 'footer at rail width' : 'footer in full'}</div>}
        topBarEnd={<span>status</span>}
        onSearch={onSearch}
      >
        <div>content</div>
      </AppShell>
    </TooltipProvider>,
  );
}

describe('AppShell on a wide screen', () => {
  it('lists every destination once, marks the current one, and draws the slots', () => {
    renderShell();
    const boxes = screen.getAllByRole('link', { name: 'Boxes' });
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('acme')).toBeInTheDocument();
    expect(screen.getByText('the caption')).toBeInTheDocument();
    expect(screen.getByText('footer in full')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
    // The phone's bar is not drawn beside the docked sidebar.
    expect(screen.queryByRole('button', { name: 'Open navigation' })).toBeNull();
  });

  it('collapses to the rail and back, remembering the choice under the prefix', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByRole('link', { name: 'Boxes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Things' })).toBeNull();
    expect(screen.getByText('footer at rail width')).toBeInTheDocument();
    expect(screen.queryByText('the caption')).toBeNull();
    expect(localStorage.getItem('test-nav:collapsed')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByRole('button', { name: 'Things' })).toBeInTheDocument();
  });

  it('keeps a shut group reachable in the rail', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'System' }));
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('reopens the rail and focuses the search field on the shortcut', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    await userEvent.keyboard('{Control>}k{/Control}');

    const field = await screen.findByRole('searchbox', { name: 'Search' });
    await vi.waitFor(() => {
      expect(field).toHaveFocus();
    });
  });
});

describe('AppShell on a phone', () => {
  it('draws the top bar, and a drawer whose control closes it', async () => {
    setNarrowViewport(true);
    renderShell();
    expect(screen.getByText('status')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Boxes' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(await screen.findByRole('link', { name: 'Boxes' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    await vi.waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Boxes' })).toBeNull();
    });
  });
});

describe('AppShell with a search of its own', () => {
  it('opens it from the field, the rail and the shortcut, and draws no field to type in', async () => {
    const onSearch = vi.fn();
    renderShell(onSearch);
    expect(screen.queryByRole('searchbox')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /^Search/ }));
    expect(onSearch).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Control>}k{/Control}');
    expect(onSearch).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(onSearch).toHaveBeenCalledTimes(3);
    // Opening the search is not a reason to expand the rail.
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('puts it in the top bar on a phone, and shuts the drawer before opening it from there', async () => {
    setNarrowViewport(true);
    const onSearch = vi.fn();
    renderShell(onSearch);

    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(onSearch).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Control>}k{/Control}');
    expect(onSearch).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    await screen.findByRole('link', { name: 'Boxes' });
    await userEvent.click(screen.getByRole('button', { name: /^Search…/ }));
    expect(onSearch).toHaveBeenCalledTimes(3);
    await vi.waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Boxes' })).toBeNull();
    });
  });
});
