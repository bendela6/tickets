import { useEffect, useMemo, useState } from 'react';
import { type CollectedDemo, Tabs } from '@tickets/ui';
import { CodeBlock } from '../../../code/code-block';
import { fileName, implPaths } from '../../../code/resolve-impl';

type LiveDemo = Extract<CollectedDemo, { slug: string }>;

export type ImplSources = Record<string, () => Promise<string>>;

// The component's own source — the file you'd edit, not the demo that shows
// it off. Loaders are lazy (one chunk per file, see gallery/demo-sources.ts),
// so nothing is fetched until this tab is opened and a file is selected.
// Components spread over several files declare them via `meta.impl`; those
// get a file switcher.
export function ImplTab({ demo, sources }: { demo: LiveDemo; sources?: ImplSources }) {
  const resolved = useMemo(
    () => implPaths(demo.path, demo.meta.impl),
    [demo.path, demo.meta.impl],
  );
  const available = useMemo(
    () => resolved.filter((path) => sources?.[path] !== undefined),
    [resolved, sources],
  );

  const [selected, setSelected] = useState(available[0]);
  // A declared file list can change under us (hot reload, demo switch); fall
  // back rather than render a stale selection that no longer resolves.
  const active = selected !== undefined && available.includes(selected) ? selected : available[0];

  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = active === undefined ? undefined : sources?.[active];
    if (!load) return;
    let cancelled = false;
    setSource(null);
    setError(null);
    void load().then(
      (text) => {
        if (!cancelled) setSource(text);
      },
      (cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [active, sources]);

  if (available.length === 0) {
    return (
      <p className="font-sans text-meta text-gray-9">
        No implementation source found for this demo — looked for{' '}
        <span className="font-mono">{resolved.join(', ')}</span>. Point{' '}
        <span className="font-mono">meta.impl</span> at the component file to show it here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-4">
        {available.length > 1 ? (
          <Tabs variant="pill" role="group"
            label="Implementation file"
            items={available.map((path) => ({ value: path, label: fileName(path) }))}
            value={active!}
            onChange={setSelected}
          />
        ) : (
          <span className="font-mono text-label uppercase tracking-widest text-gray-9">
            {fileName(active!).toUpperCase()}
          </span>
        )}
        {source !== null && (
          <span className="font-mono text-meta text-gray-9">{source.split('\n').length} lines</span>
        )}
      </div>
      {error !== null ? (
        <p className="font-sans text-meta text-red-9">Could not load source: {error}</p>
      ) : source === null ? (
        <p className="font-sans text-meta text-gray-9">Loading source…</p>
      ) : (
        <CodeBlock code={source} numbered />
      )}
    </div>
  );
}
