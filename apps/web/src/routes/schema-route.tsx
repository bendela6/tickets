import { createRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useSchemaGraph } from '../api/use-schema';
import { renderErd } from '../components/schema/erd-engine';
import '../components/schema/erd.css';
import { rootRoute } from './root-route';

export type SchemaSearch = { database?: string };

function SchemaPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { database } = schemaRoute.useSearch();
  const { data, isLoading, error } = useSchemaGraph(database);

  useEffect(() => {
    if (!data || !containerRef.current) return;
    const cleanup = renderErd(containerRef.current, data);
    return cleanup;
  }, [data]);

  return (
    <div className="h-screen overflow-auto bg-gray-1 text-gray-12">
      {isLoading && <p className="p-6 font-sans text-13 text-gray-11">Loading schema…</p>}
      {error && <p className="p-6 font-sans text-13 text-red-11">Failed to load schema.</p>}
      <div ref={containerRef} />
    </div>
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
