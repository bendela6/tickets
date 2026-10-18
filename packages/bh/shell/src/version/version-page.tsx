// The Version page: what this build is made of, in four tabs, each at its own
// path. Overview: the services and what is new. Releases: every commit, one
// list per release. Services and Packages: a table each.

import { useMemo, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Button, CardState, Pill, SearchInput, useCopy } from '@bh/ui';
import { Page } from '../layout/page';
import { PageBody } from '../layout/page-body';
import { PageHeader } from '../layout/page-header';
import { Section } from '../layout/section';
import { TabNav } from '../layout/tab-nav';
import { AppLink, useAppNavigate } from './app-link';
import {
  shortName,
  versionLabel,
  type BuildInfo,
  type Release,
  type ReleaseCommit,
} from './build-info';
import { CommitList } from './commit-line';
import { formatReleaseTime } from './release-time';
import { useRelease, useReleases } from './use-releases';
import { seenKey, useMarkSeen } from './use-seen-version';
import { PackagesTable, ServicesSummary, ServicesTable } from './version-tables';

/** The Version page's tabs, each at `<basePath>/<tab>`; the overview at `<basePath>`. */
export type VersionTab = 'overview' | 'releases' | 'services' | 'packages';

/** Props for VersionPage component. */
export interface VersionPageProps {
  /** The build's versions: `readBuildInfo()`. */
  info: BuildInfo;
  /** The page's path; each tab is under it. */
  basePath?: string;
}

/** The tab a path is on. */
export function tabOf(pathname: string, basePath: string): VersionTab {
  const rest = pathname.slice(basePath.length).replace(/^\/+|\/+$/g, '');
  return rest === 'releases' || rest === 'services' || rest === 'packages' ? rest : 'overview';
}

/** Everything a bug report needs, as plain text. */
export function detailsText(info: BuildInfo): string {
  const lines = [
    `${info.stack.name} ${versionLabel(info)}, released ${formatReleaseTime(info.stack.releasedAt)}, built ${formatReleaseTime(info.builtAt)}`,
  ];
  if (info.dev) {
    lines.push(
      `dev: ${info.dev.branch}, ${info.dev.ahead} past the tag${info.dev.dirty ? ', uncommitted changes' : ''}`,
    );
  }
  lines.push('', 'Services:');
  for (const s of info.services) {
    lines.push(`  ${s.name} ${s.version}${s.name === info.self ? ' (this page)' : ''}`);
  }
  lines.push('', 'Packages:');
  for (const p of info.packages) {
    lines.push(`  ${p.name} ${p.version}`);
  }
  if (typeof window !== 'undefined') {
    lines.push('', `Page: ${window.location.href}`, `Browser: ${navigator.userAgent}`);
  }
  return lines.join('\n');
}

/** Whether a commit concerns a service: its folder, a package it uses, or a dependency update. */
function concerns(commit: ReleaseCommit, service: string, info: BuildInfo): boolean {
  if (service === 'repo') {
    return commit.scopes.length === 0;
  }
  return commit.scopes.some((scope) => {
    return (
      scope === service ||
      scope === 'deps' ||
      info.packages.some((p) => shortName(p.name) === scope && p.usedBy.includes(service))
    );
  });
}

function Overview({ info, basePath }: { info: BuildInfo; basePath: string }) {
  const { release, error } = useRelease(info, info.stack.version);
  return (
    <>
      {info.services.length > 0 ? (
        <Section
          title="Services in this build"
          action={
            <AppLink to={`${basePath}/services`} className="text-13 text-indigo-11 hover:underline">
              All services →
            </AppLink>
          }
        >
          <ServicesSummary info={info} />
        </Section>
      ) : null}
      <Section
        title={`What's new in v${info.stack.version}`}
        count={
          release
            ? `${release.commits.length} commit${release.commits.length === 1 ? '' : 's'}`
            : undefined
        }
        action={
          <AppLink to={`${basePath}/releases`} className="text-13 text-indigo-11 hover:underline">
            All releases →
          </AppLink>
        }
      >
        <CardState
          isLoading={!release && !error}
          error={error}
          isEmpty={release?.commits.length === 0}
          emptyText="No commits listed."
        >
          <div className="rounded-8 border-gray-6 bg-surface border-1 p-16">
            <CommitList commits={release?.commits ?? []} repository={info.repository} />
          </div>
        </CardState>
      </Section>
    </>
  );
}

function ReleaseCard({
  release,
  info,
  commits,
  open,
}: {
  release: Release;
  info: BuildInfo;
  commits: ReleaseCommit[];
  open: boolean;
}) {
  return (
    <li className="border-gray-4 border-b-1 last:border-b-0">
      <details open={open} className="group">
        <summary className="hover:bg-surface-inset flex cursor-pointer list-none flex-wrap items-baseline gap-x-10 gap-y-6 px-16 py-12">
          <span className="text-15 text-gray-12 font-600 font-mono">v{release.version}</span>
          <span className="text-12 text-gray-11 tabular-nums">
            {formatReleaseTime(release.date)}
          </span>
          {release.version === info.stack.version ? (
            <span className="text-11 font-500 bg-green-3 text-green-11 rounded-full px-6 py-2">
              this build
            </span>
          ) : null}
          <span className="text-12 text-gray-10 ml-auto">
            {commits.length} commit{commits.length === 1 ? '' : 's'}
          </span>
          <span className="flex basis-full flex-wrap gap-6">
            {release.versions.map((v) => {
              return (
                <span
                  key={v.name}
                  className="rounded-4 bg-gray-3 text-gray-11 text-11 font-500 px-6 py-2 font-mono"
                >
                  {shortName(v.name)} {v.version}
                </span>
              );
            })}
          </span>
        </summary>
        <div className="px-16 pb-14">
          <CommitList commits={commits} repository={info.repository} />
        </div>
      </details>
    </li>
  );
}

function Releases({ info, basePath }: { info: BuildInfo; basePath: string }) {
  const navigate = useAppNavigate();
  const search = useRouterState({
    select: (state) => state.location.search as Record<string, unknown>,
  });
  const service = typeof search.service === 'string' ? search.service : 'all';
  const [query, setQuery] = useState('');
  const { releases, total, loading, error, loadMore } = useReleases(info);
  // No services, no filter: every commit is the repo's.
  const chips =
    info.services.length > 0 ? ['all', ...info.services.map((s) => shortName(s.name)), 'repo'] : [];
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    return releases
      .map((release) => {
        return {
          release,
          commits: release.commits.filter((c) => {
            return (
              (service === 'all' || concerns(c, service, info)) &&
              (q === '' ||
                [c.headline, ...c.bullets, c.change ?? ''].join(' ').toLowerCase().includes(q))
            );
          }),
        };
      })
      .filter((r) => r.commits.length > 0);
  }, [releases, service, q, info]);
  const pick = (next: string) => {
    return void navigate({
      to: `${basePath}/releases`,
      search: next === 'all' ? {} : { service: next },
      replace: true,
    });
  };

  return (
    <>
      <div className="flex flex-col gap-10">
        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-6" role="group" aria-label="Show">
            {chips.map((chip) => {
              return (
                <Pill
                  key={chip}
                  label={chip === 'all' ? 'All' : chip === 'repo' ? 'Outside packages' : chip}
                  variant="outline"
                  shape="round"
                  size="sm"
                  pressed={service === chip}
                  onClick={() => pick(chip)}
                />
              );
            })}
          </div>
        ) : null}
        <SearchInput
          value={query}
          onChange={setQuery}
          aria-label="Search commits"
          placeholder="Search commits"
        />
      </div>
      <CardState
        isLoading={loading && releases.length === 0}
        error={error}
        isEmpty={!loading && shown.length === 0}
        emptyText="No commits match."
      >
        <div className="rounded-8 border-gray-6 bg-surface overflow-hidden border-1">
          <ol>
            {shown.map(({ release, commits }, i) => {
              return (
                <ReleaseCard
                  key={release.version}
                  release={release}
                  info={info}
                  commits={commits}
                  open={i === 0 || q !== ''}
                />
              );
            })}
          </ol>
        </div>
      </CardState>
      {total !== null && releases.length < total ? (
        <Button
          variant="outline"
          size="sm"
          loading={loading}
          onClick={loadMore}
          className="self-start"
        >
          Load older releases
        </Button>
      ) : null}
    </>
  );
}

/**
 * The Version page: a header with the stack's version, released and built
 * times, Copy details and the tag on GitHub, then four route tabs. An app
 * routes `<basePath>` and `<basePath>/$tab` to it.
 */
export function VersionPage({ info, basePath = '/version' }: VersionPageProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const tab = tabOf(pathname, basePath);
  const { copied, copy } = useCopy();
  useMarkSeen(seenKey(info.stack.name), info.stack.version);

  return (
    <Page
      header={
        <PageHeader
          title={`${info.stack.name} ${versionLabel(info)}`}
          description={`Released ${formatReleaseTime(info.stack.releasedAt)} · Built ${formatReleaseTime(info.builtAt)}${
            info.dev ? ` · ${info.dev.branch}${info.dev.dirty ? ', uncommitted changes' : ''}` : ''
          }`}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => void copy(detailsText(info))}>
                {copied ? 'Copied' : 'Copy details'}
              </Button>
              {info.stack.url ? (
                <a
                  href={info.stack.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-6 border-gray-7 text-13 font-500 text-gray-12 hover:bg-surface-inset inline-flex h-28 items-center border-1 px-10"
                >
                  v{info.stack.version} on GitHub ↗
                </a>
              ) : null}
            </>
          }
          tabs={
            <TabNav
              label="Version"
              tabs={[
                { to: basePath, label: 'Overview' },
                { to: `${basePath}/releases`, label: 'Releases' },
                // A repo whose app is its root has no services: no tab for them.
                ...(info.services.length > 0
                  ? [{ to: `${basePath}/services`, label: 'Services', badge: info.services.length }]
                  : []),
                { to: `${basePath}/packages`, label: 'Packages', badge: info.packages.length },
              ]}
            />
          }
        />
      }
    >
      <PageBody>
        {tab === 'overview' ? <Overview info={info} basePath={basePath} /> : null}
        {tab === 'releases' ? <Releases info={info} basePath={basePath} /> : null}
        {tab === 'services' ? (
          <>
            <ServicesTable info={info} releasesPath={`${basePath}/releases`} />
            <p className="text-13 text-gray-10">
              Each version and date comes from that service&apos;s own CHANGELOG.md. History opens
              Releases filtered to the service.
            </p>
          </>
        ) : null}
        {tab === 'packages' ? <PackagesTable packages={info.packages} /> : null}
      </PageBody>
    </Page>
  );
}
