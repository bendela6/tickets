import { createRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useSchemaGraph } from '../api/use-schema';
import { EerDiagram, schemaGraphToModel } from '../components/eer';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

export type SchemaSearch = { database?: string };

function SchemaPage() {
  const { database } = schemaRoute.useSearch();
  const { data, isLoading, error } = useSchemaGraph(database);
  // `schemaGraphToModel` runs loadModel plus layout packing — memoised on
  // `data` so a fresh Model identity isn't handed to EerDiagram on every
  // render. ModelLoader (inside EerDiagram) reloads whenever `model` changes
  // identity; an unmemoised call here would retrigger that load in a loop.
  const result = useMemo(() => (data ? schemaGraphToModel(data) : null), [data]);
  // An empty database is not a broken one. `loadModel` treats empty
  // groups/entities as a load ERROR, so `?database=postgres` (zero user
  // tables) satisfies BOTH `result.errors.length > 0` and
  // `data.tables.length === 0` — the two branches below are independent, so a
  // red "This schema could not be drawn." used to stack on top of "No tables
  // in this database." The table count is the more specific diagnosis, so it
  // wins: errors only mean something once there was something to draw.
  const drawable = !!data && data.tables.length > 0;

  // AppShell — like every other shell route — is what mounts the activity rail
  // and the mode panel, and the mode panel is where the database dropdown
  // lives. Without it `/schema` renders a diagram with no way to change what
  // it is a diagram OF. No `h-screen` inside EerDiagram's viewer: AppShell's
  // <main> is already the height-constrained, `overflow-auto` scroll
  // container, so a second one inside it gives the page two scrollbars and
  // clips the diagram.
  return (
    <AppShell>
      {isLoading && <p className="p-6 font-sans text-13 text-gray-11">Loading schema…</p>}
      {error && <p className="p-6 font-sans text-13 text-red-11">Failed to load schema.</p>}
      {drawable && result?.errors.length ? (
        <p className="p-6 font-sans text-13 text-red-11">This schema could not be drawn.</p>
      ) : null}
      {data && data.tables.length === 0 && (
        <p className="p-6 font-sans text-13 text-gray-11">No tables in this database.</p>
      )}
      {result?.model && drawable ? (
        <div className="flex h-full min-h-0 flex-col">
          {/* Warnings are how a MISSING edge explains itself. An fk pointing at
              a table this graph doesn't carry is skipped by deriveRelationships
              and only warned about by loadModel — so with nothing rendering
              them the user saw a line that simply wasn't there, with no way to
              tell a real absence from a bug. Collapsed by default: a healthy
              schema shouldn't be nagged about, and a broken one shouldn't cost
              the diagram half its height. */}
          {result.warnings.length > 0 && (
            <details className="shrink-0 border-b-1 border-gray-6 bg-gray-2 px-4 py-2 font-sans text-12 text-gray-11">
              <summary className="cursor-pointer text-yellow-11">
                {result.warnings.length === 1
                  ? '1 part of this schema could not be drawn'
                  : `${result.warnings.length} parts of this schema could not be drawn`}
              </summary>
              <ul className="mt-2 list-disc pl-5">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          {/* min-h-0 + flex-1 gives EerDiagram's own `h-full` a definite height
              to resolve against, so the banner takes space from the diagram
              instead of pushing it out of the shell's scroll container. */}
          <div className="min-h-0 flex-1">
            <EerDiagram model={result.model} />
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

export const schemaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/schema',
  // Only `database` survives, and only as a non-empty string: an empty value
  // must fall back to the API's configured database rather than being sent
  // through as `?database=`.
  validateSearch: (search: Record<string, unknown>): SchemaSearch =>
    typeof search.database === 'string' && search.database.length > 0
      ? { database: search.database }
      : {},
  component: SchemaPage,
});
