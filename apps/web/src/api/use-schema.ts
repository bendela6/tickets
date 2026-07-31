import { useQuery } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { SchemaGraph } from '../components/schema/erd-types';

/** GET /api/schema/databases */
export type DatabaseList = { databases: string[]; current: string };

export function useDatabases() {
  return useQuery({
    queryKey: ['schema', 'databases'],
    queryFn: () => fetchJson<DatabaseList>('/api/schema/databases'),
  });
}

/**
 * The live schema graph. `database` undefined means "the API's configured
 * database" — the param is omitted rather than sent empty, so the default is
 * decided in one place (the route) instead of two.
 */
export function useSchemaGraph(database?: string) {
  return useQuery({
    queryKey: ['schema', 'graph', database ?? null],
    queryFn: () =>
      fetchJson<SchemaGraph>(
        database ? `/api/schema?database=${encodeURIComponent(database)}` : '/api/schema',
      ),
  });
}
