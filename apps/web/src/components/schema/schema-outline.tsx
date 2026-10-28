import { useNavigate } from '@tanstack/react-router';
import { Button, Dropdown, cn } from '@tilewise/ui';
import { useDatabases } from '../../api/use-schema';
import { EerOutline } from '../eer';
import { RailLabel } from '../shell/rail-label';

function optionClasses(active: boolean) {
  return cn(
    'flex h-32 w-full items-center rounded-8 px-9 text-left font-sans text-13/19',
    active
      ? 'bg-surface-inset font-500 text-gray-12'
      : 'text-gray-11 hover:bg-surface-inset hover:text-gray-12',
  );
}

/**
 * The schema page's side panel: which database the diagram introspects, and
 * what is in it.
 *
 * The panel picks a DATA SOURCE; the diagram renders whatever graph results.
 * That split is deliberate — it is what lets the renderer stay a pure function
 * of its input, and it is why this control sits beside the diagram rather
 * than in the diagram's own toolbar.
 *
 * Selection lives in the route's `?database=` search param, so a chosen
 * database is shareable and survives a reload. `selected` is passed in rather
 * than read here so this component stays renderable outside a router match.
 *
 * <EerOutline/> below it is the diagram's own table of contents — the filter
 * box and the groups → tables tree. It reads the diagram state the page's
 * <EerDiagramProvider> holds, the same the canvas beside it draws.
 */
export function SchemaOutline({ selected }: { selected: string | undefined }) {
  const navigate = useNavigate();
  const { data, isLoading } = useDatabases();
  const active = selected ?? data?.current;

  const choose = (name: string) => {
    // The default database is expressed by ABSENCE of the param, never by
    // writing it out — otherwise the "default" URL and the explicit one differ
    // while meaning the same thing.
    navigate({
      to: '/schema',
      search: name === data?.current ? {} : { database: name },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-12 pb-12 pt-12">
      <RailLabel className="block px-4 pb-6">DATABASE</RailLabel>
      {isLoading || !data ? null : (
        <Dropdown
          align="start"
          padding="sm"
          trigger={
            // Named, not bare: the outline below lists tables, and a database
            // called `tickets` in a panel that also has a table called
            // `tickets` gives two controls the same accessible name.
            <Button
              variant="ghost"
              aria-label={`Database: ${active ?? ''}`}
              className="w-full justify-between font-mono text-12"
            >
              {active ?? ''}
            </Button>
          }
        >
          {(close) => (
            <div className="flex w-176 flex-col gap-2">
              {data.databases.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={optionClasses(name === active)}
                  onClick={() => {
                    choose(name);
                    close();
                  }}
                >
                  <span className="truncate font-mono text-12">{name}</span>
                </button>
              ))}
            </div>
          )}
        </Dropdown>
      )}
      <div className="mt-8 flex min-h-0 flex-1 flex-col">
        <EerOutline />
      </div>
    </div>
  );
}
