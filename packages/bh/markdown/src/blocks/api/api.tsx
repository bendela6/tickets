import { BlockBar, BlockFrame, BlockTitle } from '../parts';
import { RouteRow } from './route-row';
import { toViews } from './routes';
import type { ApiData } from './schema';

/**
 * A resource and its routes, as one list. A route that carries detail opens to
 * show it rather than repeating itself as a card below, so every route appears
 * exactly once and the reader decides what is open.
 *
 * `@container`: the rows reflow on the block's own width rather than the
 * viewport's, because the block sizes itself to whoever hosts it.
 */
export function Api({ data }: { data: ApiData }) {
  const count = data.routes.length;
  return (
    <BlockFrame data-testid="api" data-resource={data.resource} className="@container">
      {data.resource ? (
        <BlockBar>
          <span data-testid="api-resource" className="contents">
            <BlockTitle>{data.resource}</BlockTitle>
            <span className="flex-1" />
            <span className="text-11 text-gray-10 shrink-0 font-mono">
              {count} {count === 1 ? 'route' : 'routes'}
            </span>
          </span>
        </BlockBar>
      ) : null}
      <div data-testid="route-list">
        {toViews(data).map((route) => {
          return <RouteRow key={route.anchor} route={route} />;
        })}
      </div>
    </BlockFrame>
  );
}
