import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ApiError } from '../../api/api-error';
import { usePatchIssueStatus, useSignalsApp, useSignalsIssues } from '../../api/signals/use-signals';
import { cn } from '@tickets/ui/cn';
import { Pill } from '@tickets/ui/pill';
import { ScreenState } from '@tickets/ui/screen-state';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../../ui/menu';
import { appInitials, avatarTone } from './apps-screen';
import { ClearSignalsDialog } from './clear-signals-dialog';
import { DeleteAppDialog } from './delete-app-dialog';
import { DsnField } from './dsn-field';
import { formatCount, formatDate } from './format';
import { IssueRow, IssueRowSkeleton } from './issue-row';
import { ReleasesCard } from './releases-card';
import { RenameAppDialog } from './rename-app-dialog';
import { RotateKeyDialog } from './rotate-key-dialog';
import { SdkSnippet } from './sdk-snippet';

// The header `⋯` menu's dialogs. No "Reveal DSN" here (unlike the roster's
// row menu) — the Connect card below already shows the DSN permanently.
type DialogKind = 'rename' | 'rotate' | 'clear' | 'delete';

const RECENT_ISSUES_PER_PAGE = 5;
const RECENT_ISSUES_SKELETON_ROWS = 3;

function AppNotFound() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <ScreenState
        title="App not found"
        action={
          <Link to="/signals/apps" className="font-sans text-meta text-accent hover:underline">
            ‹ Back to Apps
          </Link>
        }
      />
    </div>
  );
}

/**
 * App detail screen (Task 6) — the home for a single Signals app: DSN + SDK
 * snippet (Connect card), 24h stats, a releases card, and the app's most
 * recent open issues. Mirrors issue-detail-screen.tsx's page shell
 * (breadcrumb, header, stat bar, loading/404/error handling) and
 * apps-screen.tsx's avatar/initials treatment so the two screens read as
 * siblings.
 */
export function AppDetailScreen({ appId }: { appId: number }) {
  // A non-numeric route param (e.g. "/signals/apps/abc") arrives as NaN —
  // never a real app id, so it reads as "not found" without hitting the
  // network (useSignalsApp/useSignalsIssues disable themselves on it).
  const validId = Number.isFinite(appId);

  const navigate = useNavigate();
  const appQuery = useSignalsApp(appId);
  // Gated on validId — same rationale as useSignalsApp's own `enabled`: a NaN
  // appId must never reach the network, it should just read as "not found".
  const issuesQuery = useSignalsIssues(
    { app: appId, status: 'open', perPage: RECENT_ISSUES_PER_PAGE },
    validId,
  );
  const patchStatus = usePatchIssueStatus();
  const [dialog, setDialog] = useState<DialogKind | null>(null);

  if (!validId) {
    return <AppNotFound />;
  }

  if (appQuery.isLoading) {
    return null;
  }

  if (appQuery.isError) {
    // 404 reads as "this app doesn't exist" — anything else (network down,
    // 500, etc.) is transient and gets the same recoverable "Couldn't load"
    // + Retry treatment as the Issues/Apps list screens, not a false
    // "not found".
    const notFound = appQuery.error instanceof ApiError && appQuery.error.status === 404;

    if (notFound) {
      return <AppNotFound />;
    }

    return (
      <div className="flex h-full items-center justify-center p-6">
        <ScreenState
          className="max-w-115"
          tone="danger"
          icon="triangle-alert"
          title="Couldn't load app"
          body="The signals daemon isn't responding. Check that it's running, then try again."
          action={
            <button
              type="button"
              onClick={() => void appQuery.refetch()}
              className="h-8 rounded-[8px] border border-control bg-raised px-3.25 font-sans text-[12.5px] font-medium text-ink hover:bg-inset"
            >
              ↻ Retry
            </button>
          }
        />
      </div>
    );
  }

  if (appQuery.data === undefined) {
    return null;
  }

  const app = appQuery.data;
  const issueRows = issuesQuery.data?.rows ?? [];
  const signals24h = app.signals24h ?? 0;
  const errors24h = app.errors24h ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto p-6 md:p-7">
      <div className="mb-3 font-mono text-[12px] text-ink-3">
        <Link to="/signals/apps" className="text-accent hover:underline">
          ‹ Apps
        </Link>{' '}
        / {app.slug}
      </div>

      <div className="mb-4 flex items-start gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-[8px] font-mono text-[13px] font-semibold',
            avatarTone(app.slug),
          )}
        >
          {appInitials(app.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 font-sans text-[18px] leading-tight font-semibold text-ink">{app.name}</h1>
            <Pill tone="secondary" label={app.slug} className="font-mono text-[11px]" />
          </div>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label="App actions"
              className="flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-control bg-raised text-ink-2 hover:bg-inset hover:text-ink"
            >
              ⋯
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => setDialog('rename')}>Rename</MenuItem>
            <MenuItem onSelect={() => setDialog('rotate')}>Rotate key</MenuItem>
            <MenuItem onSelect={() => setDialog('clear')}>Clear signals</MenuItem>
            <MenuSeparator />
            <MenuItem destructive onSelect={() => setDialog('delete')}>
              Delete app
            </MenuItem>
          </MenuContent>
        </Menu>

        {dialog === 'rename' ? (
          <RenameAppDialog app={app} open onOpenChange={(next) => !next && setDialog(null)} />
        ) : null}
        {dialog === 'rotate' ? (
          <RotateKeyDialog app={app} open onOpenChange={(next) => !next && setDialog(null)} />
        ) : null}
        {dialog === 'clear' ? (
          <ClearSignalsDialog app={app} open onOpenChange={(next) => !next && setDialog(null)} />
        ) : null}
        {dialog === 'delete' ? (
          <DeleteAppDialog
            app={app}
            open
            onOpenChange={(next) => !next && setDialog(null)}
            onDeleted={() => void navigate({ to: '/signals/apps' })}
          />
        ) : null}
      </div>

      <div className="mb-4 flex flex-none items-center gap-6.5 rounded-[10px] border border-hairline bg-raised px-4.5 py-3">
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">SIGNALS · 24H</div>
          <div className="font-mono text-[14px] font-semibold text-ink">{formatCount(signals24h)}</div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">ERRORS · 24H</div>
          <div className={cn('font-mono text-[14px] font-medium', errors24h > 0 ? 'text-danger' : 'text-ink')}>
            {formatCount(errors24h)}
          </div>
        </div>
        <div>
          <div className="mb-0.75 font-mono text-[10px] font-medium tracking-wide text-ink-3">CREATED</div>
          <div className="font-sans text-[13px] text-ink">{formatDate(app.createdAt)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4.5 xl:grid-cols-2">
        <div className="flex-none rounded-xl border border-hairline bg-raised p-4">
          <div className="mb-3 font-sans text-[13.5px] font-semibold text-ink">Connect</div>
          <DsnField dsn={app.dsn} className="mb-3" />
          <SdkSnippet dsn={app.dsn} platform="react" />
        </div>

        <ReleasesCard appId={appId} />
      </div>

      <div className="mt-4.5 flex-none overflow-hidden rounded-xl border border-hairline bg-raised">
        <div className="flex h-10.5 items-center gap-2.5 border-b border-hairline px-4">
          <span className="font-sans text-[13.5px] font-semibold text-ink">Recent issues</span>
        </div>
        {issuesQuery.isLoading ? (
          Array.from({ length: RECENT_ISSUES_SKELETON_ROWS }).map((_, index) => (
            <IssueRowSkeleton key={index} index={index} />
          ))
        ) : issueRows.length === 0 ? (
          <div className="px-4 py-4 font-mono text-[11.5px] text-ink-3">no open issues</div>
        ) : (
          issueRows.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              onOpen={() =>
                void navigate({ to: '/signals/issues/$issueId', params: { issueId: String(issue.id) } })
              }
              onResolve={() => patchStatus.mutate({ id: issue.id, status: 'resolved' })}
              onIgnore={() => patchStatus.mutate({ id: issue.id, status: 'ignored' })}
              onReopen={() => patchStatus.mutate({ id: issue.id, status: 'open' })}
            />
          ))
        )}
      </div>
    </div>
  );
}
