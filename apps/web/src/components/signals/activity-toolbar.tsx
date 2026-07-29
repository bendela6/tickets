import type { IssueLevel, SignalsAppRow } from '../../api/signals/signals-api';
import { cn, Input } from '@tickets/ui';

const selectClasses =
  'h-7 rounded-lg border-1 border-gray-6 bg-surface-raised px-2 font-sans text-12 text-gray-11 ' +
  'hover:border-gray-7 focus:border-indigo-9 focus:outline-none focus:ring-[3px] focus:ring-indigo-3';

const DAY_OPTIONS = [7, 14, 30, 90];

// Toolbar for the Activity view (logs + events) — mirrors issues-toolbar.tsx:
// app / kind / level / day-range filters plus search, all native <select>s
// (no Combobox primitive, matching the established Signals toolbar
// convention). No status segmented control here — logs/events don't carry
// an open/resolved/ignored status the way issues do.
export function ActivityToolbar({
  apps,
  appId,
  onAppChange,
  kind,
  onKindChange,
  level,
  onLevelChange,
  days,
  onDaysChange,
  q,
  onQChange,
  dimmed,
}: {
  apps: SignalsAppRow[];
  appId: number | undefined;
  onAppChange: (appId: number | undefined) => void;
  kind: 'log' | 'event' | undefined;
  onKindChange: (kind: 'log' | 'event' | undefined) => void;
  level: IssueLevel | undefined;
  onLevelChange: (level: IssueLevel | undefined) => void;
  days: number;
  onDaysChange: (days: number) => void;
  q: string;
  onQChange: (q: string) => void;
  dimmed?: boolean;
}) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-center gap-2', dimmed && 'opacity-50')}>
      <select
        aria-label="Filter by app"
        className={selectClasses}
        value={appId ?? ''}
        onChange={(event) => onAppChange(event.target.value === '' ? undefined : Number(event.target.value))}
      >
        <option value="">App: all</option>
        {apps.map((app) => (
          <option key={app.id} value={app.id}>
            {app.slug}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by kind"
        className={selectClasses}
        value={kind ?? ''}
        onChange={(event) =>
          onKindChange(event.target.value === '' ? undefined : (event.target.value as 'log' | 'event'))
        }
      >
        <option value="">Kind: all</option>
        <option value="log">log</option>
        <option value="event">event</option>
      </select>

      <select
        aria-label="Filter by level"
        className={selectClasses}
        value={level ?? ''}
        onChange={(event) =>
          onLevelChange(event.target.value === '' ? undefined : (event.target.value as IssueLevel))
        }
      >
        <option value="">Level: all</option>
        <option value="error">error</option>
        <option value="warning">warning</option>
        <option value="info">info</option>
      </select>

      <select
        aria-label="Date range"
        className={selectClasses}
        value={days}
        onChange={(event) => onDaysChange(Number(event.target.value))}
      >
        {DAY_OPTIONS.map((option) => (
          <option key={option} value={option}>
            Last {option}d
          </option>
        ))}
      </select>

      <span className="flex-1" />

      <Input
        type="search"
        aria-label="Search activity"
        placeholder="Search message, name…"
        value={q}
        onChange={(event) => onQChange(event.target.value)}
        className="h-7 w-57.5"
      />
    </div>
  );
}
