import { useId, type ButtonHTMLAttributes } from 'react';
import { cn, focusRing, Icon } from '@bh/ui';
import { Flag, flagOf } from './flag';
import { HEAD_HEIGHT, NODE_WIDTH, ROW_HEIGHT } from './layout';
import type { ErdTable, Point } from './schema';

export type CardHandle = Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onKeyDown'
>;

export interface TableCardProps {
  name: string;
  table: ErdTable;
  /** Its corner on the unscaled canvas. */
  at: Point;
  /** Being dragged: it lifts, and its border takes the primary tone. */
  dragging: boolean;
  /** The id of the text that says how to move a card. */
  hint: string;
  /** What moves it, on the name strip: pointer drag and arrow keys. */
  handle: CardHandle;
}

/**
 * One table, as a raised card on the canvas. The name strip is the handle,
 * a button so a keyboard reaches it; the columns are an ARIA table named by
 * it, a row each: key flag, name, type.
 */
export function TableCard({ name, table, at, dragging, hint, handle }: TableCardProps) {
  const nameId = useId();
  return (
    <div
      data-testid={`erd-table-${name}`}
      data-dragging={dragging ? 'true' : undefined}
      className="rounded-6 border-gray-6 bg-surface-raised data-[dragging=true]:border-indigo-8 absolute overflow-hidden border-1 shadow-xs data-[dragging=true]:shadow-md"
      // Runtime values Tailwind cannot see: where the reader left it, and the
      // width the wires are measured against.
      style={{ left: at[0], top: at[1], width: NODE_WIDTH }}
    >
      <button
        type="button"
        aria-describedby={hint}
        {...handle}
        className={cn(
          'bg-surface-inset border-gray-6 text-12 font-600 text-gray-12 flex w-full cursor-grab touch-none items-center justify-between gap-8 border-b-1 px-10 text-left font-mono select-none active:cursor-grabbing',
          focusRing('indigo', 'focus-visible', 'inward'),
        )}
        style={{ height: HEAD_HEIGHT }}
      >
        <span id={nameId} className="min-w-0 truncate">
          {name}
        </span>
        <Icon name="grip" size="sm" className="text-gray-9" />
      </button>
      <div role="table" aria-labelledby={nameId}>
        {Object.entries(table.columns).map(([column, def]) => {
          return (
            <div
              key={column}
              role="row"
              data-column={column}
              data-key={flagOf(def)}
              // The grid template is a layout rule with no shareable value: a
              // slot a flag fits, the name, then the type.
              className="border-gray-6 grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-6 border-b-1 px-10 last:border-b-0"
              style={{ height: ROW_HEIGHT }}
            >
              <span role="cell" className="flex items-center">
                <Flag column={def} />
              </span>
              <span
                role="rowheader"
                className={cn('text-12 text-gray-12 truncate font-mono', def.pk && 'font-600')}
              >
                {column}
              </span>
              <span role="cell" className="text-11 text-gray-10 max-w-96 truncate font-mono">
                {def.type}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
