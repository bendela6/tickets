import { Fragment, type ReactNode } from 'react';
import type { IssueDetail, PlatformInfo, SignalPayload } from '../../api/signals/signals-api';
import { cn } from '@tickets/ui/cn';
import { Pill } from '@tickets/ui/pill';
import { formatCount } from './format';

function RailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex-none rounded-xl border border-hairline bg-raised p-3.5">
      <div className="mb-2.5 font-mono text-[10px] font-medium tracking-wide text-ink-3">{title}</div>
      {children}
    </div>
  );
}

function UserCard({
  user,
  userCount,
}: {
  user: Record<string, unknown> | undefined;
  userCount: number;
}) {
  const id = typeof user?.id === 'string' ? user.id : undefined;
  const email = typeof user?.email === 'string' ? user.email : undefined;

  return (
    <RailCard title="USER">
      {id !== undefined || email !== undefined ? (
        <>
          <div className="mb-2.5 flex items-center gap-2.5">
            <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-accent-subtle font-sans text-[10px] font-semibold text-accent">
              {(id ?? email ?? '??').slice(0, 2).toUpperCase()}
            </span>
            <div>
              {id !== undefined ? (
                <div className="font-mono text-[12.5px] font-medium text-ink">{id}</div>
              ) : null}
              {email !== undefined ? <div className="font-sans text-[11px] text-ink-2">{email}</div> : null}
            </div>
          </div>
          <div className="font-mono text-[11px] text-ink-3">
            hit by <span className="font-medium text-ink">{formatCount(userCount)} users</span>
          </div>
        </>
      ) : (
        <div className="font-mono text-[11px] text-ink-3">no user data</div>
      )}
    </RailCard>
  );
}

function TagPill({ tagKey, value }: { tagKey: string; value: unknown }) {
  const danger = tagKey === 'handled' && String(value) === 'no';
  return (
    <Pill
      tone={danger ? 'danger' : 'secondary'}
      label={String(value)}
      shape="full"
      className={cn('h-5 text-[11px] font-mono', !danger && 'text-ink')}
    />
  );
}

function TagsCard({
  release,
  tags,
}: {
  release: string | null | undefined;
  tags: Record<string, unknown> | undefined;
}) {
  const rows: [string, unknown][] = [];
  if (release !== null && release !== undefined) {
    rows.push(['release', release]);
  }
  for (const [key, value] of Object.entries(tags ?? {})) {
    rows.push([key, value]);
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    <RailCard title="TAGS">
      <div className="grid grid-cols-[88px_1fr] items-center gap-x-2.5 gap-y-1.75">
        {rows.map(([key, value]) => (
          <Fragment key={key}>
            <span className="font-mono text-[11px] text-ink-3">{key}</span>
            <span>
              <TagPill tagKey={key} value={value} />
            </span>
          </Fragment>
        ))}
      </div>
    </RailCard>
  );
}

// SDK identifiers are published as `@bendela6/signals-<target>` (browser,
// node, react, core) — strip that prefix for the rail chip so it reads
// "browser 0.1.0" instead of the full package name; any other/future name
// (no prefix) passes through unshortened rather than being mangled.
const SDK_NAME_PREFIX = '@bendela6/signals-';

function sdkChipLabel(sdk: Record<string, unknown> | undefined): string | undefined {
  const name = typeof sdk?.name === 'string' ? sdk.name : undefined;
  const version = typeof sdk?.version === 'string' ? sdk.version : undefined;
  if (name === undefined || version === undefined) {
    return undefined;
  }
  const shortName = name.startsWith(SDK_NAME_PREFIX) ? name.slice(SDK_NAME_PREFIX.length) : name;
  return `${shortName} ${version}`;
}

function PlatformCard({
  platform,
  sdk,
}: {
  platform: PlatformInfo | undefined;
  sdk: Record<string, unknown> | undefined;
}) {
  const sdkLabel = sdkChipLabel(sdk);
  if (platform === undefined && sdkLabel === undefined) {
    return null;
  }
  const chips: { label: string; glyph: string; accent: boolean }[] = [];
  if (platform !== undefined) {
    if (platform.browser !== undefined) {
      chips.push({ label: platform.browser, glyph: '◍', accent: false });
    }
    if (platform.os !== undefined) {
      chips.push({ label: platform.os, glyph: '◍', accent: false });
    }
    chips.push({
      label: platform.runtime,
      glyph: platform.runtime === 'browser' ? '◍' : '⬡',
      accent: true,
    });
  }
  if (sdkLabel !== undefined) {
    chips.push({ label: sdkLabel, glyph: '⬢', accent: false });
  }

  return (
    <RailCard title="PLATFORM">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip, index) => (
          <span
            key={index}
            className={cn(
              'inline-flex h-5 items-center gap-1 rounded-ctrl px-1.75 font-mono text-[10.5px] font-medium',
              chip.accent ? 'bg-opt-blue-subtle text-opt-blue' : 'bg-inset text-ink-2',
            )}
          >
            {chip.glyph} {chip.label}
          </span>
        ))}
      </div>
    </RailCard>
  );
}

function formatContextValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '—';
  return JSON.stringify(value);
}

// Skip the `event` key — it's the raw event mirror the SDK always attaches,
// not a user-supplied context worth surfacing here.
function ContextCard({ contexts }: { contexts: Record<string, unknown> | undefined }) {
  const entries = Object.entries(contexts ?? {}).filter(([key]) => key !== 'event');
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex-none rounded-xl border border-hairline bg-raised p-3.5">
      {entries.map(([key, value], index) => {
        const fields =
          value !== null && typeof value === 'object' ? Object.entries(value as Record<string, unknown>) : [];
        return (
          <div key={key} className={index > 0 ? 'mt-3.5' : undefined}>
            <div className="mb-2.5 font-mono text-[10px] font-medium tracking-wide text-ink-3">
              CONTEXT · {key.toUpperCase()}
            </div>
            <div className="grid grid-cols-[96px_1fr] gap-x-2.5 gap-y-1.5 font-mono text-[11.5px]">
              {fields.map(([fieldKey, fieldValue]) => (
                <Fragment key={fieldKey}>
                  <span className="text-ink-3">{fieldKey}</span>
                  <span className="text-ink">{formatContextValue(fieldValue)}</span>
                </Fragment>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Context rail (docs/design/SigIssueDetail.dc.html): USER / TAGS / PLATFORM /
 * CONTEXT·X cards built from the same occurrence payload the stack trace and
 * breadcrumbs cards read from. Any card with nothing to show renders `null`
 * rather than an empty shell.
 */
export function ContextRail({ issue, payload }: { issue: IssueDetail; payload: SignalPayload | undefined }) {
  return (
    <div className="flex flex-col gap-3.5 overflow-auto">
      <UserCard user={payload?.user} userCount={issue.userCount} />
      <TagsCard release={issue.releaseRange.last} tags={payload?.tags} />
      <PlatformCard platform={payload?.platform} sdk={payload?.sdk} />
      <ContextCard contexts={payload?.contexts} />
    </div>
  );
}
