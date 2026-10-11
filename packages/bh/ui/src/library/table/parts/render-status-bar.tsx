import type { RenderStatusBarCtx } from '@bh/table';
import { TABLE_STATUS_BAR } from './metrics';

/** Sort state as one short phrase: "Name ↑" or "Status ↓, Price ↑". Empty
 *  when nothing sorts, so the bar says nothing rather than saying "none". */
function sortSummary(sort: RenderStatusBarCtx['sort']): string {
  return sort.map((s) => `${s.field} ${s.direction === 'asc' ? '↑' : '↓'}`).join(', ');
}

/**
 * The bar across the bottom of the table.
 *
 * What it is FOR: the table has no scrollbar of its own any more, so the two
 * things a scrollbar used to say without being asked — how much of this there
 * is, and where in it you are — have to be said in words. It answers the first
 * directly and gives the page somewhere to answer the second ("1–50 of
 * 4,812", "page 2 of 97").
 *
 * The left half is the caller's, because the counts that matter are usually
 * the server's and the engine only ever sees a page of rows. The right half is
 * the engine's own: what is selected and how the table is sorted, which are
 * facts about the table itself and true whatever it is a table of.
 *
 * Mono, like every other number in this table. The bar is data about data.
 */
export function renderStatusBar({ rowCount, selectedCount, sort, status }: RenderStatusBarCtx) {
  const parts = [
    selectedCount > 0 ? `${selectedCount} selected` : null,
    sort.length > 0 ? `sort: ${sortSummary(sort)}` : null,
  ].filter(Boolean);
  return (
    <div className={TABLE_STATUS_BAR} data-slot="table-status">
      {/* `min-w-0` on both halves, so whichever one is longer gives up its
          own space rather than pushing the other off the end. */}
      <span className="min-w-0 truncate">
        {status ?? `${rowCount} ${rowCount === 1 ? 'row' : 'rows'}`}
      </span>
      <span className="text-gray-9 min-w-0 truncate">{parts.join(' · ')}</span>
    </div>
  );
}
