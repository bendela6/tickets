import type { BoardTicket } from '../../api/types';
import { cn } from '../../ui/cn';
import { KindGlyph, type StatusKind } from '../../ui/kind-glyph';
import type { BoardIndexes } from '../../utils/index-board';

const KIND_ORDER: { kind: StatusKind; label: string; textClass: string }[] = [
  { kind: 'todo', label: 'To do', textClass: 'text-kind-todo' },
  { kind: 'active', label: 'Active', textClass: 'text-kind-active' },
  { kind: 'blocked', label: 'Blocked', textClass: 'text-kind-blocked' },
  { kind: 'done', label: 'Done', textClass: 'text-kind-done' },
  { kind: 'dropped', label: 'Dropped', textClass: 'text-kind-dropped' },
];

// Per-kind count tiles per docs/design/03-project-board.html lines 116–125;
// the trailing × hides the strip (persisted as `kpi: false` in the view
// config, re-enabled from the Columns popover).
export function KpiStrip({
  tickets,
  indexes,
  onHide,
}: {
  tickets: BoardTicket[];
  indexes: BoardIndexes;
  onHide: () => void;
}) {
  const byKind: Record<StatusKind, number> = {
    todo: 0,
    active: 0,
    blocked: 0,
    done: 0,
    dropped: 0,
  };
  for (const ticket of tickets) {
    const raw = indexes.statusField ? ticket.values[indexes.statusField.key] : undefined;
    const kind =
      (typeof raw === 'string' ? indexes.statusByKey.get(raw)?.kind : undefined) ?? 'todo';
    byKind[kind] += 1;
  }

  return (
    <div className="mb-3.5 flex shrink-0 gap-2.5">
      {KIND_ORDER.map(({ kind, label, textClass }) => (
        <div
          key={kind}
          className="flex flex-1 items-center gap-2.5 rounded-[10px] border border-hairline bg-raised px-3.5 py-2.5 shadow-sm"
        >
          <span className={cn('inline-flex shrink-0', textClass)}>
            <KindGlyph kind={kind} />
          </span>
          <span className="font-mono text-[18px] leading-none font-semibold text-ink">
            {byKind[kind]}
          </span>
          <span className="font-sans text-meta text-ink-2">{label}</span>
        </div>
      ))}
      <button
        type="button"
        title="Hide KPI strip"
        aria-label="Hide KPI strip"
        className="flex w-7 cursor-pointer items-center justify-center font-sans text-meta text-ink-3 hover:text-ink"
        onClick={onHide}
      >
        ×
      </button>
    </div>
  );
}
