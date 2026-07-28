import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { SignalsAppRow } from '../../api/signals/signals-api';
import { useSignalsApps, useSignalsMeta } from '../../api/signals/use-signals';
import { Button, cn, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, ScreenState, Spinner } from '@tickets/ui';
import { ClearSignalsDialog } from './clear-signals-dialog';
import { DeleteAppDialog } from './delete-app-dialog';
import { formatBytes, formatCount, formatDate } from './format';
import { NewAppDialog } from './new-app-dialog';
import { RenameAppDialog } from './rename-app-dialog';
import { RevealDsnDialog } from './reveal-dsn-dialog';
import { RotateKeyDialog } from './rotate-key-dialog';

// dot · app · signals · errors · created · ⋯ actions — one fewer column than
// the design's grid (no Platform tag: SignalsAppRow carries no platform
// field in v1). The ⋯ actions column (Task 7) is a real grid column, not an
// absolute overlay, so it never covers the Created column's text.
const APPS_GRID_COLUMNS = 'minmax(0,1fr) 130px 120px 150px 40px';

// The row `⋯` menu's non-"Open" actions — "Open" is handled locally by
// AppRow (it just navigates) rather than round-tripping through this union.
type DialogKind = 'rename' | 'reveal' | 'rotate' | 'clear' | 'delete';

const ONBOARDING_STEPS = [
  { n: 1, title: 'Create an app', body: 'Name it, pick a platform, get a DSN.' },
  { n: 2, title: 'Install the SDK', body: 'React, Node, or a plain script tag.' },
  { n: 3, title: 'Watch signals land', body: 'Errors group into issues automatically.' },
];

// "storefront-web" -> "SW", "admin" -> "AD" — same split-on-dash/space
// convention as ui/avatar.tsx's `initials`, just square-badged for apps
// rather than the person/agent avatar's circle. Exported — app-detail-screen.tsx
// reuses it for the detail header's avatar.
export function appInitials(name: string): string {
  const parts = name.trim().split(/[\s-]+/).filter((part) => part.length > 0);
  const first = parts[0] ?? '';
  const second = parts[1] ?? parts[0]?.slice(1) ?? '';
  return (first.slice(0, 1) + second.slice(0, 1)).toUpperCase();
}

// Per-app badge color (design SigApps varies the initials badge per app so a
// roster reads as distinct rows, not a column of identical accent squares).
// Deterministic from the slug so an app keeps its color across renders/reloads.
const AVATAR_TONES = [
  'bg-indigo-3 text-indigo-9',
  'bg-green-3 text-green-9',
  'bg-orange-3 text-orange-9',
  'bg-surface-inset text-gray-11',
];

export function avatarTone(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

function TableHeader() {
  return (
    <div
      role="row"
      className="grid h-9 shrink-0 items-center border-b border-gray-6 bg-gray-1 px-3.5 font-sans text-label font-500 tracking-wider text-gray-11 uppercase"
      style={{ gridTemplateColumns: APPS_GRID_COLUMNS }}
    >
      <span>App</span>
      <span className="text-right">Signals · 24h</span>
      <span className="text-right">Errors · 24h</span>
      <span>Created</span>
      <span />
    </div>
  );
}

function AppRow({
  app,
  onAction,
}: {
  app: SignalsAppRow;
  onAction: (app: SignalsAppRow, kind: DialogKind) => void;
}) {
  const navigate = useNavigate();

  function goToApp() {
    void navigate({ to: '/signals/apps/$appId', params: { appId: String(app.id) } });
  }

  return (
    <div
      role="row"
      onClick={goToApp}
      className="group grid h-12.5 cursor-pointer items-center border-b border-gray-6 px-3.5 last:border-b-0 hover:bg-gray-1"
      style={{ gridTemplateColumns: APPS_GRID_COLUMNS }}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            'flex size-5.5 shrink-0 items-center justify-center rounded-[6px] font-mono text-9 font-600',
            avatarTone(app.slug),
          )}
        >
          {appInitials(app.name)}
        </span>
        <span className="truncate font-mono text-13 font-500 text-gray-12">{app.slug}</span>
      </span>
      <span className="text-right font-mono text-12 font-500 text-gray-12">
        {formatCount(app.signals24h)}
      </span>
      <span
        className={cn(
          'text-right font-mono text-12',
          app.errors24h > 0 ? 'font-500 text-red-9' : 'text-gray-9',
        )}
      >
        {app.errors24h > 0 ? formatCount(app.errors24h) : '—'}
      </span>
      <span className="pl-6 font-mono text-11 text-gray-9">{formatDate(app.createdAt)}</span>
      {/* stopPropagation on the whole cell — both the trigger and (via the
      portal-rendered MenuContent living outside this row's DOM subtree)
      every item click must never also fire the row's onClick/goToApp. */}
      <span className="flex justify-end" onClick={(event) => event.stopPropagation()}>
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label={`${app.slug} actions`}
              className="hidden size-7 items-center justify-center rounded-md text-gray-9 hover:bg-surface-inset hover:text-gray-12 group-hover:flex data-[state=open]:flex"
            >
              ⋯
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={goToApp}>Open</MenuItem>
            <MenuItem onSelect={() => onAction(app, 'rename')}>Rename</MenuItem>
            <MenuItem onSelect={() => onAction(app, 'reveal')}>Reveal DSN</MenuItem>
            <MenuItem onSelect={() => onAction(app, 'rotate')}>Rotate key</MenuItem>
            <MenuItem onSelect={() => onAction(app, 'clear')}>Clear signals</MenuItem>
            <MenuSeparator />
            <MenuItem destructive onSelect={() => onAction(app, 'delete')}>
              Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </span>
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
  // Which app + which management dialog the row `⋯` menu last opened. One
  // shared pair of state (not per-row) so only the dialog actually in use
  // mounts — and therefore only it fires its data hook (useAppReleases for
  // Clear, useSignalsApp for Reveal DSN) — instead of every row's menu
  // eagerly fetching on the off chance it gets opened.
  const [activeApp, setActiveApp] = useState<SignalsAppRow | null>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);

  function handleAction(app: SignalsAppRow, kind: DialogKind) {
    setActiveApp(app);
    setDialog(kind);
  }

  function closeDialog(open: boolean) {
    if (!open) {
      setDialog(null);
    }
  }

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
        <h1 className="m-0 font-sans text-[22px] leading-tight font-600 text-gray-12">Signals</h1>
        {!isLoading && !isError ? <span className="font-mono text-meta text-gray-9">{headMeta}</span> : null}
        <span className="flex-1" />
        {!isEmpty ? (
          <Button variant="solid" onClick={() => setNewAppOpen(true)}>
            ＋ New app
          </Button>
        ) : null}
      </div>

      {/* Nav lives in the Signals sidebar panel — see issues-screen.tsx. */}

      {isList ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-gray-6 bg-surface-raised">
            <TableHeader />
            <div className="flex-1 overflow-auto">
              {rows.map((app) => (
                <AppRow key={app.id} app={app} onAction={handleAction} />
              ))}
            </div>
          </div>
          <div className="flex h-9.5 shrink-0 items-center gap-2 px-1 pt-2 font-mono text-11 text-gray-9">
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
          <span className="flex items-center gap-2.5 font-mono text-[11.5px] text-gray-9">
            <Spinner size="xs" tone="secondary" />
            loading apps…
          </span>
        </div>
      ) : null}

      {isError ? (
        <div className="flex flex-1 items-center justify-center">
          <ScreenState
            className="max-w-115"
            tone="danger"
            icon="triangle-alert"
            title="Couldn't load apps"
            body="The signals daemon isn't responding. Check that it's running, then try again."
            action={
              <button
                type="button"
                onClick={() => void appsQuery.refetch()}
                className="h-8 rounded-[8px] border border-gray-7 bg-surface-raised px-3.25 font-sans text-[12.5px] font-500 text-gray-12 hover:bg-surface-inset"
              >
                ↻ Retry
              </button>
            }
          />
        </div>
      ) : null}

      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex max-w-137.5 flex-col items-center gap-4.5 text-center">
            <span className="flex size-11 items-center justify-center rounded-[11px] bg-indigo-3 font-mono text-[22px] text-indigo-9">
              ∿
            </span>
            <div className="font-sans text-[22px] font-600 text-gray-12">Connect your first app</div>
            <div className="max-w-110 text-pretty font-sans text-13 leading-relaxed text-gray-11">
              Signals is your local error and event monitor. Register an app to get a DSN, drop the SDK
              into your code, and everything it reports lands here — nothing leaves this machine.
            </div>
            <Button variant="solid" onClick={() => setNewAppOpen(true)}>
              ＋ New app
            </Button>
            <div className="mt-1.5 flex gap-3">
              {ONBOARDING_STEPS.map((step) => (
                <div
                  key={step.n}
                  className="w-46.5 rounded-[10px] border border-gray-6 bg-surface-raised p-3.5 text-left"
                >
                  <span className="block font-mono text-10 text-gray-9">{step.n}</span>
                  <span className="mt-1.5 block font-sans text-[12.5px] font-500 text-gray-12">
                    {step.title}
                  </span>
                  <span className="mt-1 block font-sans text-[11.5px] leading-relaxed text-gray-11">
                    {step.body}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <NewAppDialog open={newAppOpen} onOpenChange={setNewAppOpen} />

      {activeApp && dialog === 'rename' ? (
        <RenameAppDialog app={activeApp} open onOpenChange={closeDialog} />
      ) : null}
      {activeApp && dialog === 'reveal' ? (
        <RevealDsnDialog app={activeApp} open onOpenChange={closeDialog} />
      ) : null}
      {activeApp && dialog === 'rotate' ? (
        <RotateKeyDialog app={activeApp} open onOpenChange={closeDialog} />
      ) : null}
      {activeApp && dialog === 'clear' ? (
        <ClearSignalsDialog app={activeApp} open onOpenChange={closeDialog} />
      ) : null}
      {activeApp && dialog === 'delete' ? (
        <DeleteAppDialog app={activeApp} open onOpenChange={closeDialog} />
      ) : null}
    </div>
  );
}
