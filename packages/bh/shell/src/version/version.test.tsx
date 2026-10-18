// The version line and the Version page: the line's text, its dot and Reload,
// the rail's icon, each tab at its path, Releases filtered by service and by
// search, and the details a bug report copies.

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@bh/ui';

const router = vi.hoisted(() => {
  return { pathname: '/version', search: {}, navigate: vi.fn() };
});

vi.mock('@tanstack/react-router', () => {
  return {
    Link: ({
      to,
      search,
      children,
      ...rest
    }: {
      to: string;
      search?: Record<string, string>;
      children: ReactNode;
    }) => {
      return (
        <a href={search ? `${to}?${new URLSearchParams(search).toString()}` : to} {...rest}>
          {children}
        </a>
      );
    },
    useNavigate: () => router.navigate,
    useRouterState: ({
      select,
    }: {
      select: (state: { location: { pathname: string; search: unknown } }) => unknown;
    }) => {
      return select({ location: { pathname: router.pathname, search: router.search } });
    },
  };
});

import type { BuildInfo, Release } from './build-info';
import { BuildFooter, versionLine } from './build-footer';
import { formatReleaseTime } from './release-time';
import { seenKey } from './use-seen-version';
import { detailsText, tabOf, VersionPage } from './version-page';

const INFO: BuildInfo = {
  stack: {
    name: 'tickets',
    version: '0.4.1',
    releasedAt: '2026-10-17T14:32:00+04:00',
    url: 'https://github.com/o/tickets/tree/v0.4.1',
  },
  repository: 'https://github.com/o/tickets',
  base: '/',
  builtAt: '2026-10-17T10:34:00.000Z',
  self: '@tickets/web',
  services: [
    {
      name: '@tickets/web',
      dir: 'apps/web',
      version: '0.3.2',
      releasedAt: '2026-10-17T14:32:00+04:00',
      previous: '0.3.1',
      commits: 3,
    },
    {
      name: '@tickets/api',
      dir: 'apps/api',
      version: '0.5.1',
      releasedAt: '2026-10-17T14:32:00+04:00',
      previous: '0.5.0',
      commits: 0,
    },
    {
      name: '@tickets/mcp',
      dir: 'apps/mcp',
      version: '0.1.4',
      releasedAt: '2026-10-09T11:05:00+04:00',
    },
  ],
  packages: [
    {
      name: '@tickets/shared',
      dir: 'packages/shared',
      version: '0.2.5',
      releasedAt: '2026-10-17T14:32:00+04:00',
      previous: '0.2.4',
      usedBy: ['web', 'api', 'mcp'],
    },
    {
      name: '@bh/ui',
      dir: 'packages/bh/ui',
      version: '0.9.0',
      releasedAt: '2026-10-18T09:00:00+04:00',
      usedBy: ['web'],
    },
  ],
};

const commit = (type: string, scopes: string[], headline: string, hash: string) => {
  return {
    type,
    scopes,
    breaking: false,
    headline,
    hash,
    bullets: [],
    change: null,
  };
};

const RELEASES: Release[] = [
  {
    version: '0.4.1',
    date: '2026-10-17T14:32:00+04:00',
    versions: [{ name: '@tickets/web', version: '0.3.2' }],
    commits: [
      commit('feat', ['web'], 'add drag and drop between board columns', 'a1b2c3d'),
      commit('fix', ['shared'], 'store dates in UTC', 'b7c2e19'),
      commit('chore', [], 'run api and web together in pnpm dev', 'f0a1b2c'),
    ],
  },
  {
    version: '0.4.0',
    date: '2026-10-09T11:05:00+04:00',
    versions: [{ name: '@tickets/api', version: '0.5.0' }],
    commits: [
      {
        ...commit('fix', ['api', 'web'], 'refuse tickets with an empty title', '8e7d6c5'),
        bullets: ['Disable Save until the title has text'],
      },
      commit('feat', ['mcp'], 'list tickets by board', '1a2b3c4'),
    ],
  },
];

function serve(build = { version: '0.4.1' }) {
  const files: Record<string, unknown> = {
    '/build.json': build,
    '/releases/index.json': RELEASES.map((r) => {
      return {
        version: r.version,
        date: r.date,
        versions: r.versions,
        commits: r.commits.length,
      };
    }),
    ...Object.fromEntries(RELEASES.map((r) => [`/releases/${r.version}.json`, r])),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      return Promise.resolve({
        ok: url in files,
        status: url in files ? 200 : 404,
        json: () => Promise.resolve(files[url]),
      });
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  router.pathname = '/version';
  router.search = {};
  router.navigate.mockReset();
  serve();
});
afterEach(() => vi.unstubAllGlobals());

describe('formatReleaseTime', () => {
  it('writes the day, short month, year and a 24-hour time in the given zone', () => {
    expect(formatReleaseTime('2026-10-17T14:32:00+04:00', 'Asia/Tbilisi')).toBe(
      '17 Oct 2026, 14:32',
    );
    expect(formatReleaseTime('2026-10-17T22:05:00+04:00', 'UTC')).toBe('17 Oct 2026, 18:05');
    expect(formatReleaseTime('')).toBe('—');
  });
});

describe('BuildFooter', () => {
  const footer = (info: BuildInfo, collapsed = false) => {
    return render(
      <TooltipProvider>
        <BuildFooter info={info} collapsed={collapsed} />
      </TooltipProvider>,
    );
  };

  it('links the version and release time to the Version page', () => {
    footer(INFO);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/version');
    expect(link).toHaveTextContent(versionLine(INFO).replace(' · ', '· '));
    expect(versionLine(INFO)).toMatch(/^v0\.4\.1 · \d+ Oct 2026, \d\d:\d\d$/);
  });

  it('says dev and how far past the tag a dev server is, with the build time', () => {
    footer({ ...INFO, dev: { branch: 'main', ahead: 3, dirty: true } });
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText('v0.4.1+3')).toBeInTheDocument();
  });

  it('dots a version this browser has not seen, not on its first visit', () => {
    const { unmount } = footer(INFO);
    expect(screen.queryByRole('img', { name: 'New version' })).toBeNull();
    expect(localStorage.getItem(seenKey('tickets'))).toBe('0.4.1');
    unmount();
    footer({ ...INFO, stack: { ...INFO.stack, version: '0.4.2' } });
    expect(screen.getByRole('img', { name: 'New version' })).toBeInTheDocument();
  });

  it('offers Reload when the window regains focus and a newer version is live', async () => {
    serve({ version: '0.4.2' });
    footer(INFO);
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(await screen.findByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('is one icon at rail width, named by the line', () => {
    footer(INFO, true);
    expect(screen.getByRole('link', { name: `Version ${versionLine(INFO)}` })).toHaveAttribute(
      'href',
      '/version',
    );
  });
});

describe('VersionPage', () => {
  it('reads the tab from the path', () => {
    expect(tabOf('/version', '/version')).toBe('overview');
    expect(tabOf('/version/releases', '/version')).toBe('releases');
    expect(tabOf('/version/packages/', '/version')).toBe('packages');
    expect(tabOf('/version/nope', '/version')).toBe('overview');
  });

  it("shows the services and this release's commits on the overview, and marks the version seen", async () => {
    localStorage.setItem(seenKey('tickets'), '0.4.0');
    render(<VersionPage info={INFO} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('tickets v0.4.1');
    expect(screen.getByRole('button', { name: 'Services 3' })).toBeInTheDocument();
    expect(await screen.findByText('add drag and drop between board columns')).toBeInTheDocument();
    expect(screen.getByText('feat(web):')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'a1b2c3d' })).toHaveAttribute(
      'href',
      'https://github.com/o/tickets/commit/a1b2c3d',
    );
    expect(localStorage.getItem(seenKey('tickets'))).toBe('0.4.1');
  });

  it('leaves out the services, their tab and the filter for a repo whose app is its root', async () => {
    const cv: BuildInfo = { ...INFO, self: 'cv', services: [] };
    const { unmount } = render(<VersionPage info={cv} />);
    expect(screen.queryByRole('button', { name: /^Services/ })).toBeNull();
    expect(screen.queryByText('Services in this build')).toBeNull();
    expect(await screen.findByText('add drag and drop between board columns')).toBeInTheDocument();
    unmount();

    router.pathname = '/version/releases';
    render(<VersionPage info={cv} />);
    expect(await screen.findByText('list tickets by board')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Show' })).toBeNull();
  });

  it('lists every release, filtered by the service in the address, and by search', async () => {
    router.pathname = '/version/releases';
    router.search = { service: 'mcp' };
    const { rerender } = render(<VersionPage info={INFO} />);
    // mcp's own commit, and shared's, which mcp uses
    expect(await screen.findByText('list tickets by board')).toBeInTheDocument();
    expect(screen.getByText('store dates in UTC')).toBeInTheDocument();
    expect(screen.queryByText('add drag and drop between board columns')).toBeNull();

    router.search = {};
    rerender(<VersionPage info={INFO} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search commits' }), 'empty title');
    await waitFor(() => expect(screen.queryByText('store dates in UTC')).toBeNull());
    expect(screen.getByText('refuse tickets with an empty title')).toBeInTheDocument();
    expect(screen.getByText('Disable Save until the title has text')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'web' }));
    expect(router.navigate).toHaveBeenCalledWith({
      to: '/version/releases',
      search: { service: 'web' },
      replace: true,
    });
  });

  it('tables the services, with History filtering Releases to each, and every package in one table', () => {
    router.pathname = '/version/services';
    const { unmount } = render(<VersionPage info={INFO} />);
    const web = screen.getByRole('row', { name: /@tickets\/web/ });
    expect(within(web).getByText('was 0.3.1')).toBeInTheDocument();
    expect(within(web).getByText('3 commits')).toBeInTheDocument();
    expect(within(web).getByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      '/version/releases?service=web',
    );
    expect(
      within(screen.getByRole('row', { name: /@tickets\/api/ })).getByText('From its packages'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /@tickets\/mcp/ })).getByText('Unchanged'),
    ).toBeInTheDocument();
    unmount();

    router.pathname = '/version/packages';
    render(<VersionPage info={INFO} />);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(
      within(screen.getByRole('row', { name: /@bh\/ui/ })).getByText('web'),
    ).toBeInTheDocument();
  });

  it('copies everything a bug report needs', () => {
    const text = detailsText({ ...INFO, dev: { branch: 'main', ahead: 2, dirty: false } });
    expect(text).toMatch(/^tickets v0\.4\.1\+2, released/);
    expect(text).toContain('dev: main, 2 past the tag');
    expect(text).toContain('  @tickets/web 0.3.2 (this page)');
    expect(text).toContain('  @bh/ui 0.9.0');
  });
});
