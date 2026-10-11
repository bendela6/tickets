import { cn, focusRing, Icon } from '@bh/ui';
import { Method } from './method';
import { Path } from './path';
import { RouteDetail } from './route-detail';
import type { RouteView } from './routes';

/*
 * The row is a grid (method, path, summary, chevron), so the paths line up
 * across rows and both text cells truncate instead of spilling. The template is
 * a layout rule with no shareable value, so it stays an arbitrary value. Below
 * the block's own `md` width (a container query on the frame, since the block
 * sizes itself to whoever hosts it) the summary drops to its own line under
 * the path and wraps there. The chevron is placed outright, so a row with no
 * summary keeps it in the last column.
 */
const GRID =
  'grid w-full grid-cols-[56px_minmax(0,auto)_minmax(0,1fr)_12px] items-center gap-x-12 px-12 py-8 text-left ' +
  '@max-md:grid-cols-[56px_minmax(0,1fr)_12px] @max-md:gap-y-4';
const OUTER = 'border-gray-6 border-b-1 last:border-b-0';

function Cells({ route }: { route: RouteView }) {
  return (
    <>
      <Method method={route.method} />
      <Path path={route.path} />
      {route.summary ? (
        <span className="text-13/20 text-gray-11 min-w-0 truncate @max-md:col-span-2 @max-md:col-start-2 @max-md:row-start-2 @max-md:whitespace-normal">
          {route.summary}
        </span>
      ) : null}
    </>
  );
}

/**
 * One route, once. A route carrying detail is a disclosure the reader opens;
 * one carrying none has nothing to open and stays a plain row.
 *
 * `details`/`summary` rather than a state hook: it is keyboard-operable,
 * announced as a disclosure, and works with no JavaScript at all.
 */
export function RouteRow({ route }: { route: RouteView }) {
  if (!route.detailed) {
    return (
      <div
        id={route.anchor}
        data-testid="route"
        data-method={route.method}
        className={cn(GRID, OUTER)}
      >
        <Cells route={route} />
      </div>
    );
  }

  return (
    <details
      id={route.anchor}
      data-testid="route"
      data-method={route.method}
      data-detailed="true"
      className={cn('group', OUTER)}
    >
      <summary
        className={cn(
          GRID,
          'hover:bg-gray-2 group-open:bg-gray-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden',
          focusRing('indigo', 'focus-visible', 'inward'),
        )}
      >
        <Cells route={route} />
        <Icon
          name="chevron-right"
          size="xs"
          className="text-gray-9 col-start-4 row-start-1 justify-self-end transition-transform group-open:rotate-90 @max-md:col-start-3"
        />
      </summary>
      <RouteDetail route={route} />
    </details>
  );
}
