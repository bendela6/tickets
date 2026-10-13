// A destination with pages of its own, and its status: the dot says its state
// in words, the row opens by itself while one of its pages is on screen and by
// its chevron otherwise, exactly one page is lit, and at rail width the icon
// opens a menu of the pages that the mouse and the keyboard can both use.

import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Box, Gauge } from 'lucide-react';
import { TooltipProvider } from '@bh/ui';
import { currentLeaf } from './current-leaf';
import { NavGroup } from './nav-group';
import { NavRow } from './nav-row';
import type { NavItem, NavSection } from './nav-types';
import { RailNav } from './rail-nav';

const navigate = vi.hoisted(() => vi.fn());

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
    useNavigate: () => navigate,
  };
});

const ENGINE: NavItem = {
  label: 'Engine',
  path: '/machines/engine',
  icon: Gauge,
  status: 'warn',
  count: 2,
  children: [
    { label: 'Status', path: '/machines/engine' },
    { label: 'Parts', path: '/machines/engine/parts' },
  ],
};
const PUMP: NavItem = { label: 'Pump', path: '/machines/pump', icon: Box, status: 'down' };
const MACHINES: NavSection = { id: 'machines', label: 'Machines', items: [ENGINE, PUMP] };
// A destination whose pages live elsewhere, not under its own path.
const SPARES: NavItem = {
  label: 'Spares',
  path: '/group/spares',
  icon: Box,
  children: [
    { label: 'Belts', path: '/belts' },
    { label: 'Filters', path: '/filters' },
  ],
};
const STORES: NavSection = { id: 'stores', label: 'Stores', items: [SPARES] };

beforeEach(() => {
  navigate.mockClear();
});

describe('currentLeaf', () => {
  it('lights the longest matching page, and none off the destination', () => {
    const pages = ENGINE.children ?? [];
    expect(currentLeaf(pages, '/machines/engine')).toBe('/machines/engine');
    expect(currentLeaf(pages, '/machines/engine/parts')).toBe('/machines/engine/parts');
    expect(currentLeaf(pages, '/machines/engine/parts/7')).toBe('/machines/engine/parts');
    expect(currentLeaf(pages, '/machines/pump')).toBeUndefined();
  });
});

describe('the status dot', () => {
  it('says the state in words beside the label', () => {
    render(<NavRow item={PUMP} current={false} />);
    expect(screen.getByRole('link', { name: /Pump/ })).toHaveTextContent('Down');
  });
});

describe('NavBranch, through NavGroup', () => {
  it('stays shut away from its pages, and its chevron opens it without navigating', async () => {
    render(<NavGroup section={MACHINES} currentPath="/machines/pump" storagePrefix="t" />);
    expect(screen.queryByRole('link', { name: 'Parts' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Engine pages' }));

    expect(screen.getByRole('link', { name: 'Parts' })).toHaveAttribute(
      'href',
      '/machines/engine/parts',
    );
    expect(screen.getByRole('button', { name: 'Engine pages' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens by itself on one of its pages, and lights that page alone', () => {
    render(<NavGroup section={MACHINES} currentPath="/machines/engine/parts" storagePrefix="t" />);
    expect(screen.getByRole('link', { name: 'Parts' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Status' })).not.toHaveAttribute('aria-current');
    // The destination's own row is lit, but the announcement is the page's.
    expect(screen.getByRole('link', { name: /Engine/ })).not.toHaveAttribute('aria-current');
  });

  it('opens by itself on one of its pages when they live outside its own path', () => {
    render(<NavGroup section={STORES} currentPath="/filters" storagePrefix="t" />);
    expect(screen.getByRole('button', { name: 'Spares pages' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Filters' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Belts' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /Spares/ })).not.toHaveAttribute('aria-current');
  });

  it('can be shut by hand while one of its pages is on screen', async () => {
    render(<NavGroup section={MACHINES} currentPath="/machines/engine" storagePrefix="t" />);
    expect(screen.getByRole('link', { name: 'Status' })).toHaveAttribute('aria-current', 'page');

    await userEvent.click(screen.getByRole('button', { name: 'Engine pages' }));

    expect(screen.queryByRole('link', { name: 'Status' })).toBeNull();
  });
});

describe('RailMenu, through RailNav', () => {
  function renderRail(currentPath: string) {
    return render(
      <TooltipProvider>
        <RailNav sections={[MACHINES]} currentPath={currentPath} />
      </TooltipProvider>,
    );
  }

  it('opens a menu of the pages on click, and picking one navigates there', async () => {
    renderRail('/machines/pump');
    await userEvent.click(screen.getByRole('button', { name: 'Engine' }));

    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((m) => m.textContent),
    ).toEqual(['Status', 'Parts']);
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Parts' }));

    expect(navigate).toHaveBeenCalledWith({ to: '/machines/engine/parts' });
  });

  it('works from the keyboard alone', async () => {
    renderRail('/machines/pump');
    screen.getByRole('button', { name: 'Engine' }).focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('menu');
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toMatchObject({
      to: expect.stringMatching(/^\/machines\/engine/),
    });
  });

  it('lights the icon on one of its pages when they live outside its own path', () => {
    render(
      <TooltipProvider>
        <RailNav sections={[STORES]} currentPath="/filters" />
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: 'Spares' })).toHaveClass('bg-indigo-3');
  });

  it('keeps a destination without pages a plain link, with its dot', () => {
    renderRail('/machines/pump');
    const pump = screen.getByRole('link', { name: 'Pump' });
    expect(pump).toHaveAttribute('href', '/machines/pump');
    expect(pump).toHaveTextContent('Down');
  });
});
