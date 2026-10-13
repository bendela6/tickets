// TabNav tests: active tab from the pathname (exact and prefix match, the
// longest winning), a param URL-encoded into a tab's value, a missing param
// left as `$name`, the badges, what follows the tabs, and the row that scrolls.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const routerState = vi.hoisted(() => {
  return { pathname: '/', navigate: vi.fn() };
});

vi.mock('@tanstack/react-router', () => {
  return {
    useNavigate: () => routerState.navigate,
    useRouterState: ({
      select,
    }: {
      select: (state: { location: { pathname: string } }) => unknown;
    }) => {
      return select({ location: { pathname: routerState.pathname } });
    },
  };
});

import { fillParams } from './fill-params';
import { TabNav } from './tab-nav';

describe('fillParams', () => {
  it('URL-encodes a param value substituted into the pattern', () => {
    expect(fillParams('/sites/$domain/crawl', { domain: 'a b.com' })).toBe(
      '/sites/a%20b.com/crawl',
    );
  });

  it('leaves a missing param placeholder in place', () => {
    expect(fillParams('/sites/$domain/crawl', {})).toBe('/sites/$domain/crawl');
  });

  it('leaves a pattern with no placeholders untouched', () => {
    expect(fillParams('/settings', undefined)).toBe('/settings');
  });
});

describe('TabNav', () => {
  it('marks the tab matching the pathname exactly as active', () => {
    routerState.pathname = '/sites/example.com/crawl';
    render(
      <TabNav
        tabs={[
          { to: '/sites/$domain/crawl', label: 'Crawl' },
          { to: '/sites/$domain/pages', label: 'Pages' },
        ]}
        params={{ domain: 'example.com' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Crawl' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Pages' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks the tab active on a prefix match beneath its path', () => {
    routerState.pathname = '/sites/example.com/crawl/deep/nested';
    render(
      <TabNav
        tabs={[{ to: '/sites/$domain/crawl', label: 'Crawl' }]}
        params={{ domain: 'example.com' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Crawl' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('URL-encodes a param value in the tab target and navigates on click', async () => {
    routerState.pathname = '/sites/a%20b.com/crawl';
    routerState.navigate.mockClear();
    render(
      <TabNav
        tabs={[{ to: '/sites/$domain/crawl', label: 'Crawl' }]}
        params={{ domain: 'a b.com' }}
      />,
    );
    const tab = screen.getByRole('button', { name: 'Crawl' });
    expect(tab).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(tab);
    expect(routerState.navigate).toHaveBeenCalledWith({ to: '/sites/a%20b.com/crawl' });
  });

  it('leaves a missing param as the literal `$name` placeholder', () => {
    routerState.pathname = '/sites/$domain/crawl';
    render(<TabNav tabs={[{ to: '/sites/$domain/crawl', label: 'Crawl' }]} />);
    expect(screen.getByRole('button', { name: 'Crawl' })).toHaveAttribute('aria-pressed', 'true');
  });
});

// A tab at the page's own path has every other tab under it, so the first
// match would keep it lit on all of them; the longest is the one on screen.
describe('TabNav, a tab at the page’s own path', () => {
  const TABS = [
    { to: '/boxes/$id', label: 'Overview' },
    { to: '/boxes/$id/items', label: 'Items' },
    { to: '/boxes/$id/settings', label: 'Settings' },
  ];

  const pressed = () => {
    return screen
      .getAllByRole('button')
      .filter((tab) => tab.getAttribute('aria-pressed') === 'true')
      .map((tab) => tab.textContent);
  };

  it('lights only itself at that path', () => {
    routerState.pathname = '/boxes/7';
    render(<TabNav tabs={TABS} params={{ id: '7' }} />);
    expect(pressed()).toEqual(['Overview']);
  });

  it('gives way to the longer tab the path is under', () => {
    routerState.pathname = '/boxes/7/items';
    render(<TabNav tabs={TABS} params={{ id: '7' }} />);
    expect(pressed()).toEqual(['Items']);
  });

  it('lights the longest on a route nested deeper than any tab', () => {
    routerState.pathname = '/boxes/7/items/12/history';
    render(<TabNav tabs={TABS} params={{ id: '7' }} />);
    expect(pressed()).toEqual(['Items']);
  });

  it('lights the longest whichever order the tabs come in', () => {
    routerState.pathname = '/boxes/7/settings';
    render(<TabNav tabs={[...TABS].reverse()} params={{ id: '7' }} />);
    expect(pressed()).toEqual(['Settings']);
  });

  it('reads a trailing slash as the path without it', () => {
    routerState.pathname = '/boxes/7/';
    render(<TabNav tabs={TABS} params={{ id: '7' }} />);
    expect(pressed()).toEqual(['Overview']);
  });

  it('does not take a path that only begins with a tab’s as under it', () => {
    routerState.pathname = '/boxes/7/items-archive';
    render(<TabNav tabs={TABS} params={{ id: '7' }} />);
    expect(pressed()).toEqual(['Overview']);
  });

  it('lights none when the path is under none', () => {
    routerState.pathname = '/elsewhere';
    render(<TabNav tabs={TABS} params={{ id: '7' }} />);
    expect(pressed()).toEqual([]);
  });

  // A ticket open beside the views (`/p/KEY/t/12` by `/p/KEY/v/3`) is under none
  // of them, and lights none: not the first view.
  it('lights none on a sibling route the tabs share a parent with', () => {
    routerState.pathname = '/p/KEY/t/12';
    render(
      <TabNav
        tabs={[
          { to: '/p/KEY/v/3', label: 'Board' },
          { to: '/p/KEY/v/4', label: 'Backlog' },
        ]}
      />,
    );
    expect(pressed()).toEqual([]);
  });

  it('takes a tab at the root as the one everything is under', () => {
    routerState.pathname = '/boxes/7';
    render(
      <TabNav
        tabs={[
          { to: '/', label: 'Home' },
          { to: '/boxes', label: 'Boxes' },
        ]}
      />,
    );
    expect(pressed()).toEqual(['Boxes']);
  });
});

describe('TabNav, badges and the row', () => {
  it('shows a badge beside a tab’s name, and none where it has none', () => {
    routerState.pathname = '/boxes/7';
    render(
      <TabNav
        tabs={[
          { to: '/boxes/7', label: 'Overview' },
          { to: '/boxes/7/items', label: 'Items', badge: 2 },
          { to: '/boxes/7/labels', label: 'Labels', badge: '3 unset' },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveTextContent(/^Overview$/);
    expect(screen.getByRole('button', { name: 'Items 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Labels 3 unset' })).toBeInTheDocument();
  });

  it('names the row as it is told, Sections by default', () => {
    routerState.pathname = '/boxes/7';
    const tabs = [{ to: '/boxes/7', label: 'Overview' }];
    const { rerender } = render(<TabNav tabs={tabs} />);
    expect(screen.getByRole('group', { name: 'Sections' })).toBeInTheDocument();
    rerender(<TabNav tabs={tabs} label="Box 7’s sections" />);
    expect(screen.getByRole('group', { name: 'Box 7’s sections' })).toBeInTheDocument();
  });

  // The row is as wide as its tabs inside a box that scrolls, so on a phone it
  // scrolls sideways instead of wrapping or widening the page.
  it('sits in a row that scrolls sideways', () => {
    routerState.pathname = '/boxes/7';
    render(<TabNav tabs={[{ to: '/boxes/7', label: 'Overview' }]} variant="pill" />);
    const group = screen.getByRole('group', { name: 'Sections' });
    expect(group.className).toContain('w-max');
    expect(group.parentElement?.className).toContain('overflow-x-auto');
  });

  it('scrolls the row until the active tab shows', () => {
    routerState.pathname = '/boxes/7/settings';
    const rect = (left: number, width: number) => {
      return { left, right: left + width, width } as DOMRect;
    };
    const boxes = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    boxes.mockImplementation(function box(this: HTMLElement) {
      // The row is 200 wide; the active tab sits from 260 to 340, past its edge.
      return this.getAttribute('aria-pressed') === 'true' ? rect(260, 80) : rect(0, 200);
    });
    render(
      <TabNav
        tabs={[
          { to: '/boxes/7', label: 'Overview' },
          { to: '/boxes/7/settings', label: 'Settings' },
        ]}
      />,
    );
    const row = screen.getByRole('group', { name: 'Sections' }).parentElement;
    expect(row?.scrollLeft).toBe(140);
    boxes.mockRestore();
  });
});

// Something after the tabs, like tickets' "New view": in the row, but not one
// of its tabs, so it is never lit and pressing it goes nowhere.
describe('TabNav, what follows the tabs', () => {
  const TABS = [
    { to: '/boxes/7', label: 'Overview' },
    { to: '/boxes/7/items', label: 'Items' },
  ];

  it('draws it after the last tab, outside the strip', () => {
    routerState.pathname = '/boxes/7';
    render(<TabNav tabs={TABS} trailing={<button type="button">New view</button>} />);
    const strip = screen.getByRole('group', { name: 'Sections' });
    const after = screen.getByRole('button', { name: 'New view' });
    const last = screen.getByRole('button', { name: 'Items' });
    expect(strip).not.toContainElement(after);
    expect(last.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is never lit, and pressing it navigates nowhere', async () => {
    routerState.pathname = '/elsewhere';
    routerState.navigate.mockClear();
    const onClick = vi.fn();
    render(
      <TabNav
        tabs={TABS}
        trailing={
          <button type="button" onClick={onClick}>
            New view
          </button>
        }
      />,
    );
    const after = screen.getByRole('button', { name: 'New view' });
    expect(after).not.toHaveAttribute('aria-pressed');
    await userEvent.click(after);
    expect(onClick).toHaveBeenCalledOnce();
    expect(routerState.navigate).not.toHaveBeenCalled();
  });

  it('follows the tabs in the pill row too', () => {
    routerState.pathname = '/boxes/7';
    render(
      <TabNav tabs={TABS} variant="pill" trailing={<button type="button">New view</button>} />,
    );
    const strip = screen.getByRole('group', { name: 'Sections' });
    expect(strip).not.toContainElement(screen.getByRole('button', { name: 'New view' }));
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('scrolls to no pressed toggle after the tabs when no tab is lit', () => {
    routerState.pathname = '/elsewhere';
    const boxes = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    boxes.mockImplementation(function box(this: HTMLElement) {
      // The row is 200 wide; the pressed toggle after the tabs sits past it.
      const left = this.textContent === 'Wrap' ? 400 : 0;
      const width = this.textContent === 'Wrap' ? 40 : 200;
      return { left, right: left + width, width } as DOMRect;
    });
    render(
      <TabNav
        tabs={TABS}
        trailing={
          <button type="button" aria-pressed="true">
            Wrap
          </button>
        }
      />,
    );
    const row = screen.getByRole('group', { name: 'Sections' }).closest('.overflow-x-auto');
    expect(row?.scrollLeft).toBe(0);
    boxes.mockRestore();
  });
});
