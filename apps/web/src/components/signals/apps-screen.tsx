import { useState } from 'react';
import type { SignalsAppRow } from '../../api/signals/signals-api';
import { useSignalsApps, useSignalsMeta } from '../../api/signals/use-signals';
import { Button } from '../../ui/button';
import { cn } from '../../ui/cn';
import { formatBytes, formatCount, formatDate } from './format';
import { NewAppDialog } from './new-app-dialog';

// dot · app · signals · errors · created — one fewer column than the
// design's grid (no Platform or ⋯ actions: SignalsAppRow carries neither a
// platform tag nor per-app actions in v1).
const APPS_GRID_COLUMNS = 'minmax(0,1fr) 130px 120px 150px';

const ONBOARDING_STEPS = [
  { n: 1, title: 'Create an app', body: 'Name it, pick a platform, get a DSN.' },
  { n: 2, title: 'Install the SDK', body: 'React, Node, or a plain script tag.' },
  { n: 3, title: 'Watch signals land', body: 'Errors group into issues automatically.' },
];

// "storefront-web" -> "SW", "admin" -> "AD" — same split-on-dash/space
// convention as ui/avatar.tsx's `initials`, just square-badged for apps
// rather than the person/agent avatar's circle.
function appInitials(name: string): string {
  const parts = name.trim().split(/[\s-]+/).filter((part) => part.length > 0);
  const first = parts[0] ?? '';
  const second = parts[1] ?? parts[0]?.slice(1) ?? '';
  return (first.slice(0, 1) + second.slice(0, 1)).toUpperCase();
}

function TableHeader() {
  return (
    <div
      role="row"
      className="grid h-9 shrink-0 items-center border-b border-hairline bg-app px-3.5 font-sans text-label font-medium tracking-wider text-ink-2 uppercase"
      style={{ gridTemplateColumns: APPS_GRID_COLUMNS }}
    >
      <span>App</span>
      <span className="text-right">Signals · 24h</span>
      <span className="text-right">Errors · 24h</span>
      <span>Created</span>
    </div>
  );
}

function AppRow({ app }: { app: SignalsAppRow }) {
  return (
    <div
      role="row"
      className="grid h-12.5 items-center border-b border-hairline px-3.5 last:border-b-0"
      style={{ gridTemplateColumns: APPS_GRID_COLUMNS }}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-5.5 shrink-0 items-center justify-center rounded-[6px] bg-accent-subtle font-mono text-[9px] font-semibold text-accent">
          {appInitials(app.name)}
        </span>
        <span className="truncate font-mono text-[13px] font-medium text-ink">{app.slug}</span>
      </span>
      <span className="text-right font-mono text-[12px] font-medium text-ink">
        {formatCount(app.signals24h)}
      </span>
      <span
        className={cn(
          'text-right font-mono text-[12px]',
          app.errors24h > 0 ? 'font-medium text-danger' : 'text-ink-3',
        )}
      >
        {app.errors24h > 0 ? formatCount(app.errors24h) : '—'}
      </span>
      <span className="pl-6 font-mono text-[11px] text-ink-3">{formatDate(app.createdAt)}</span>
    </div>
  );
}

// The Signals section's Apps screen (docs/design/SigApps.dc.html, variants
// list/new/empty): app roster with 24h signal/error counts, plus the
// "＋ New app" onboarding dialog (new-app-dialog.tsx) that hands back a DSN
// and copy-paste SDK snippets.
export function AppsScreen() {
  const appsQuery = useSignalsApps();
  const metaQuery = useSignalsMeta();
  const [newAppOpen, setNewAppOpen] = useState(false);

  const rows = appsQuery.data ?? [];
  const isLoading = appsQuery.isLoading;
  const isError = appsQuery.isError;
  const isEmpty = !isLoading && !isError && rows.length === 0;
  const isList = !isLoading && !isError && !isEmpty;

  const totalSignals24h = rows.reduce((sum, app) => sum + app.signals24h, 0);
  const headMeta = isEmpty
    ? 'no apps yet'
    : `${rows.length} ${rows.length === 1 ? 'app' : 'apps'} · ${formatCount(totalSignals24h)} signals last 24h`;

  return (
    <div className="flex h-full min-h-0 flex-col p-6 md:p-7">
      <div className="mb-2.5 flex flex-wrap items-center gap-3">
        <h1 className="m-0 font-sans text-[22px] leading-tight font-semibold text-ink">Signals</h1>
        {!isLoading && !isError ? <span className="font-mono text-meta text-ink-3">{headMeta}</span> : null}
        <span className="flex-1" />
        {!isEmpty ? (
          <Button variant="primary" onClick={() => setNewAppOpen(true)}>
            ＋ New app
          </Button>
        ) : null}
      </div>

      {/* Nav lives in the Signals sidebar panel — see issues-screen.tsx. */}

      {isList ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-hairline bg-raised">
            <TableHeader />
            <div className="flex-1 overflow-auto">
              {rows.map((app) => (
                <AppRow key={app.id} app={app} />
              ))}
            </div>
          </div>
          <div className="flex h-9.5 shrink-0 items-center gap-2 px-1 pt-2 font-mono text-[11px] text-ink-3">
            <span>
              {rows.length} {rows.length === 1 ? 'app' : 'apps'} · sending to {window.location.origin}
              /signals-api
            </span>
            <span className="flex-1" />
            {metaQuery.data ? <span>{formatBytes(metaQuery.data.dbSizeBytes)} on disk</span> : null}
          </div>
        </>
      ) : null}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="flex items-center gap-2.5 font-mono text-[11.5px] text-ink-3">
            <span
              aria-hidden
              className="size-2.75 animate-spin rounded-full border-2 border-hairline border-t-ink-2"
            />
            loading apps…
          </span>
        </div>
      ) : null}

      {isError ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex max-w-115 flex-col items-center gap-3.5 text-center">
            <span className="flex size-9.5 items-center justify-center rounded-[10px] bg-danger-subtle font-mono text-[16px] font-semibold text-danger">
              ✕
            </span>
            <div className="font-sans text-[17px] font-semibold text-ink">Couldn't load apps</div>
            <div className="font-sans text-[12.5px] leading-normal text-ink-2">
              The signals daemon isn't responding. Check that it's running, then try again.
            </div>
            <button
              type="button"
              onClick={() => void appsQuery.refetch()}
              className="mt-0.5 h-8 rounded-[8px] border border-control bg-raised px-3.25 font-sans text-[12.5px] font-medium text-ink hover:bg-inset"
            >
              ↻ Retry
            </button>
          </div>
        </div>
      ) : null}

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex max-w-137.5 flex-col items-center gap-4.5 text-center">
            <span className="flex size-11 items-center justify-center rounded-[11px] bg-accent-subtle font-mono text-[22px] text-accent">
              ∿
            </span>
            <div className="font-sans text-[22px] font-semibold text-ink">Connect your first app</div>
            <div className="max-w-110 text-pretty font-sans text-[13px] leading-relaxed text-ink-2">
              Signals is your local error and event monitor. Register an app to get a DSN, drop the SDK
              into your code, and everything it reports lands here — nothing leaves this machine.
            </div>
            <Button variant="primary" onClick={() => setNewAppOpen(true)}>
              ＋ New app
            </Button>
            <div className="mt-1.5 flex gap-3">
              {ONBOARDING_STEPS.map((step) => (
                <div
                  key={step.n}
                  className="w-46.5 rounded-[10px] border border-hairline bg-raised p-3.5 text-left"
                >
                  <span className="block font-mono text-[10px] text-ink-3">{step.n}</span>
                  <span className="mt-1.5 block font-sans text-[12.5px] font-medium text-ink">
                    {step.title}
                  </span>
                  <span className="mt-1 block font-sans text-[11.5px] leading-relaxed text-ink-2">
                    {step.body}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <NewAppDialog open={newAppOpen} onOpenChange={setNewAppOpen} />
    </div>
  );
}
