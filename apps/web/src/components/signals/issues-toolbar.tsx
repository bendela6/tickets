import type { IssueLevel, IssueStatus, SignalsAppRow } from '../../api/signals/signals-api';
import { cn, Input, SegmentedControl } from '@tickets/ui';

const selectClasses =
  'h-7 rounded-[7px] border border-gray-6 bg-surface-raised px-2 font-sans text-[12px] text-gray-11 ' +
  'hover:border-gray-7 focus:border-indigo-9 focus:outline-none focus:ring-[3px] focus:ring-indigo-3';

const STATUSES: IssueStatus[] = ['open', 'resolved', 'ignored'];
const DAY_OPTIONS = [7, 14, 30, 90];

// Toolbar per docs/design/SigIssues.dc.html lines 44-55: app filter, status
// segmented control (with counts), level filter, day-range filter, search.
// App/level/days use native <select>s rather than the Combobox primitive —
// no popover-driven interaction is worth the weight here, and preflight is
// on so the native control already matches the token palette.
export function IssuesToolbar({
  apps,
  appId,
  onAppChange,
  status,
  onStatusChange,
  statusCounts,
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
  status: IssueStatus;
  onStatusChange: (status: IssueStatus) => void;
  statusCounts: Record<IssueStatus, number | undefined>;
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

      <SegmentedControl
        className="h-7"
        label="Filter by status"
        options={STATUSES.map((candidate) => ({
          value: candidate,
          label: (
            <>
              {candidate.charAt(0).toUpperCase() + candidate.slice(1)}
              <span className="font-mono text-[11px] text-gray-9">{statusCounts[candidate] ?? ''}</span>
            </>
          ),
        }))}
        value={status}
        onChange={(next) => onStatusChange(next as IssueStatus)}
      />

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
        aria-label="Search issues"
        placeholder="Search message, type, file…"
        value={q}
        onChange={(event) => onQChange(event.target.value)}
        className="h-7 w-57.5"
      />
    </div>
  );
}
