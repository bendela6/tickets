// The nav parts over a small made-up list: a row marks the current route and
// carries its count and dot, a group toggles and remembers under the app's
// prefix, a section's action sits beside its header, and the rail reaches
// every destination, even one in a shut group.

import type { ReactNode } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Box, Inbox, LayoutDashboard, Plus, Settings } from 'lucide-react';
import { TooltipProvider } from '@bh/ui';
import { NavGroup } from './nav-group';
import { NavLeafRow } from './nav-leaf-row';
import { NavRow } from './nav-row';
import { NAV_STATUS } from './nav-status';
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

const BOXES: NavItem = { label: 'Boxes', path: '/boxes', icon: Box, count: 12 };
const INBOX: NavItem = { label: 'Inbox', path: '/inbox', icon: Inbox, dot: true };
const HOME: NavSection = {
  id: 'home',
  items: [{ label: 'Home', path: '/', icon: LayoutDashboard }],
};
const THINGS: NavSection = { id: 'things', label: 'Things', items: [BOXES, INBOX] };
const SYSTEM: NavSection = {
  id: 'system',
  label: 'System',
  items: [{ label: 'Settings', path: '/settings', icon: Settings }],
};
const SECTIONS: readonly NavSection[] = [HOME, THINGS, SYSTEM];

describe('NavRow', () => {
  it('marks the current destination and shows its count', () => {
    render(<NavRow item={BOXES} current />);
    const link = screen.getByRole('link', { name: /Boxes/ });
    expect(link).toHaveAttribute('href', '/boxes');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveTextContent('12');
  });

  it('leaves a destination that is not current unmarked', () => {
    render(<NavRow item={INBOX} current={false} />);
    expect(screen.getByRole('link', { name: /Inbox/ })).not.toHaveAttribute('aria-current');
  });
});

describe('NavGroup', () => {
  it('lights the row the current path is under', () => {
    render(<NavGroup section={THINGS} currentPath="/boxes/7" storagePrefix="test-nav" />);
    expect(screen.getByRole('link', { name: /Boxes/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Inbox/ })).not.toHaveAttribute('aria-current');
  });

  it('shuts on its header, shows how many rows it hides, and remembers under the prefix', async () => {
    const user = userEvent.setup();
    render(<NavGroup section={THINGS} currentPath="/" storagePrefix="test-nav" />);
    const header = screen.getByRole('button', { name: /Things/ });
    expect(header).toHaveAttribute('aria-expanded', 'true');

    await user.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(header).toHaveTextContent('2');
    expect(screen.queryByRole('link', { name: /Boxes/ })).toBeNull();
    expect(window.localStorage.getItem('test-nav:group:things')).not.toBeNull();
  });

  it('draws the leading section without a header', () => {
    render(<NavGroup section={HOME} currentPath="/" storagePrefix="test-nav" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('aria-current', 'page');
  });
});

describe('NavGroup, a section with an action', () => {
  const withAction = (onSelect = vi.fn()): NavSection => {
    return { ...THINGS, action: { label: 'New thing', icon: Plus, onSelect } };
  };

  it('names the button by its label and shows the label as its tooltip', async () => {
    render(
      <TooltipProvider>
        <NavGroup section={withAction()} currentPath="/" storagePrefix="action-nav" />
      </TooltipProvider>,
    );
    const action = screen.getByRole('button', { name: 'New thing' });
    act(() => {
      action.focus();
    });
    expect(await screen.findByRole('tooltip')).toHaveTextContent('New thing');
  });

  it('runs onSelect on a press, and leaves the section open or shut', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <TooltipProvider>
        <NavGroup section={withAction(onSelect)} currentPath="/" storagePrefix="action-nav-2" />
      </TooltipProvider>,
    );
    const header = screen.getByRole('button', { name: /Things/ });
    const action = screen.getByRole('button', { name: 'New thing' });

    await user.click(action);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(header).toHaveAttribute('aria-expanded', 'true');

    await user.click(header);
    await user.click(action);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('is reached by Tab after the toggle', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <NavGroup section={withAction()} currentPath="/" storagePrefix="action-nav-3" />
      </TooltipProvider>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: /Things/ })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'New thing' })).toHaveFocus();
  });

  it('draws none on the leading section, which has no header', () => {
    const leading: NavSection = {
      ...HOME,
      action: { label: 'New home', icon: Plus, onSelect: vi.fn() },
    };
    render(
      <TooltipProvider>
        <NavGroup section={leading} currentPath="/" storagePrefix="action-nav-4" />
      </TooltipProvider>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws none in the rail', () => {
    render(
      <TooltipProvider>
        <RailNav sections={[HOME, withAction(), SYSTEM]} currentPath="/" />
      </TooltipProvider>,
    );
    expect(screen.queryByRole('button', { name: 'New thing' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Boxes' })).toBeInTheDocument();
  });
});

describe('RailNav', () => {
  it('reaches every destination by its label and marks the current one', () => {
    render(
      <TooltipProvider>
        <RailNav sections={SECTIONS} currentPath="/settings" />
      </TooltipProvider>,
    );
    const rail = screen.getByRole('navigation', { name: 'Sections' });
    const links = within(rail).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Home',
      'Boxes',
      'Inbox',
      'Settings',
    ]);
    expect(within(rail).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('a row’s accessible name', () => {
  it('reads its label and its count apart, not run together', () => {
    render(<NavRow item={BOXES} current={false} />);
    expect(screen.getByRole('link')).toHaveAccessibleName('Boxes, 12');
  });

  it('reads its status after them, in words', () => {
    render(<NavRow item={{ ...BOXES, status: 'up' }} current={false} />);
    expect(screen.getByRole('link')).toHaveAccessibleName(`Boxes, 12, ${NAV_STATUS.up.label}`);
  });

  it('reads a page’s count apart from its label too', () => {
    render(
      <NavLeafRow
        leaf={{ label: 'Open', path: '/boxes/open', count: 3 }}
        current={false}
        atPage={false}
      />,
    );
    expect(screen.getByRole('link')).toHaveAccessibleName('Open, 3');
  });

  it('is its label alone when it has neither', () => {
    render(<NavRow item={INBOX} current={false} />);
    expect(screen.getByRole('link')).toHaveAccessibleName('Inbox');
  });
});
