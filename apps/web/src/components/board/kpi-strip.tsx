import type { Item, StatusKind } from '../../api/types';
import { KIND_ICON, KIND_TONE } from '../../domain/status';
import { Icon } from '@tickets/ui';
import type { BoardIndexes } from '../../utils/index-board';

const KIND_ORDER: { kind: StatusKind; label: string }[] = [
  { kind: 'todo', label: 'To do' },
  { kind: 'active', label: 'Active' },
  { kind: 'blocked', label: 'Blocked' },
  { kind: 'done', label: 'Done' },
  { kind: 'dropped', label: 'Dropped' },
];

// Per-kind count tiles per docs/design/03-project-board.html lines 116–125;
// the trailing × hides the strip (persisted as `kpi: false` in the view
// config, re-enabled from the Columns popover). Presentational half: callers
// that span several boards (the all-tickets screen) pass precomputed counts.
export function KpiTiles({
  counts,
  onHide,
}: {
  counts: Record<StatusKind, number>;
  onHide: () => void;
}) {
  return (
    <div className="mb-3.5 flex shrink-0 gap-2.5">
      {KIND_ORDER.map(({ kind, label }) => (
        <div
          key={kind}
          className="flex flex-1 items-center gap-2.5 rounded-[10px] border border-gray-6 bg-surface-raised px-3.5 py-2.5 shadow-sm"
        >
          <span className="inline-flex shrink-0">
            <Icon name={KIND_ICON[kind]} tone={KIND_TONE[kind]} size={10} />
          </span>
          <span className="font-mono text-[18px] leading-none font-semibold text-gray-12">
            {counts[kind]}
          </span>
          <span className="font-sans text-meta text-gray-11">{label}</span>
        </div>
      ))}
      <button
        type="button"
        title="Hide KPI strip"
        aria-label="Hide KPI strip"
        className="flex w-7 cursor-pointer items-center justify-center font-sans text-meta text-gray-9 hover:text-gray-12"
        onClick={onHide}
      >
        ×
      </button>
    </div>
  );
}

/** Single-board variant: derives the per-kind counts from the board's tickets. */
export function KpiStrip({
  tickets,
  indexes,
  onHide,
}: {
  tickets: Item[];
  indexes: BoardIndexes;
  onHide: () => void;
}) {
  const counts: Record<StatusKind, number> = {
    todo: 0,
    active: 0,
    blocked: 0,
    done: 0,
    dropped: 0,
  };
  for (const ticket of tickets) {
    const workflowField = indexes.workflowField(ticket.typeId);
    const raw = workflowField ? ticket.values[workflowField.key] : undefined;
    const kind =
      (typeof raw === 'string' && workflowField
        ? indexes.optionByValue(workflowField, raw)?.kind
        : undefined) ?? 'todo';
    counts[kind] += 1;
  }
  return <KpiTiles counts={counts} onHide={onHide} />;
}
