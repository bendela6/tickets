import { createRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { fetchJson } from '../api/client';
import { renderErd } from '../components/schema/erd-engine';
import type { SchemaGraph } from '../components/schema/erd-types';
import '../components/schema/erd.css';
import { rootRoute } from './root-route';

function SchemaPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['schema'],
    queryFn: () => fetchJson<SchemaGraph>('/api/schema'),
  });

  useEffect(() => {
    if (!data || !containerRef.current) return;
    const cleanup = renderErd(containerRef.current, data);
    return cleanup;
  }, [data]);

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: 'var(--color-app)', color: 'var(--color-ink)' }}>
      {isLoading && <p style={{ padding: 24 }}>Loading schema…</p>}
      {error && <p style={{ padding: 24, color: 'var(--color-danger)' }}>Failed to load schema.</p>}
      <div ref={containerRef} />
    </div>
  );
}

export const schemaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/schema',
  component: SchemaPage,
});
