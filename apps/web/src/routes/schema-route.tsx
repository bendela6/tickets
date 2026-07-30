import { createRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useSchemaGraph } from '../api/use-schema';
import { renderErd } from '../components/schema/erd-engine';
import '../components/schema/erd.css';
import { AppShell } from '../components/shell/app-shell';
import { rootRoute } from './root-route';

export type SchemaSearch = { database?: string };

function SchemaPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { database } = schemaRoute.useSearch();
  const { data, isLoading, error } = useSchemaGraph(database);
  // A loaded graph with nothing in it, not "not loaded yet" — `postgres` is a
  // selectable database with zero user tables, and a blank pane there is
  // indistinguishable from a broken one.
  const isEmpty = data !== undefined && data.tables.length === 0;

  useEffect(() => {
    if (!data || !containerRef.current) return;
    const cleanup = renderErd(containerRef.current, data);
    return cleanup;
  }, [data]);

  // AppShell — like every other shell route — is what mounts the activity rail
  // and the mode panel, and the mode panel is where the database dropdown
  // lives. Without it `/schema` renders a diagram with no way to change what
  // it is a diagram OF. No `h-screen` here: AppShell's <main> is already the
  // height-constrained, `overflow-auto` scroll container, so a second one
  // inside it gives the page two scrollbars and clips the diagram.
  return (
    <AppShell>
      {isLoading && <p className="p-6 font-sans text-13 text-gray-11">Loading schema…</p>}
      {error && <p className="p-6 font-sans text-13 text-red-11">Failed to load schema.</p>}
      {isEmpty && <p className="p-6 font-sans text-13 text-gray-11">No tables in this database.</p>}
      <div ref={containerRef} />
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
