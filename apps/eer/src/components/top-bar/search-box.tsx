import { useState } from 'react';

import type { EerDiagram } from '../../engine/diagram/eer-diagram';
import type { SearchResult } from '../../engine/model/types';

export function SearchBox({ engine }: { engine: EerDiagram | null }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);

  const run = (q: string) => {
    setQuery(q);
    const r = engine?.search(q) ?? [];
    setResults(r);
    setOpen(r.length > 0);
  };

  const pick = (m: SearchResult) => {
    engine?.focusFromSearch(m.entityId, m.field);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative">
      <input
        type="text"
        name="eer-search"
        value={query}
        placeholder="Search entities / fields…"
        autoComplete="off"
        spellCheck={false}
        className="w-[190px] rounded-md border border-border bg-surface px-2.5 py-1.5 text-[0.78rem] text-ink outline-none placeholder:text-dim focus:border-border-2"
        onChange={(e) => run(e.target.value)}
        onFocus={() => setOpen(results.length > 0)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) pick(results[0]);
          if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
        }}
      />
      {open && (
        <div className="absolute left-0 top-[110%] z-30 max-h-[340px] min-w-[230px] overflow-auto rounded-lg border border-border-2 bg-surface-2 p-1 shadow-[0_12px_34px_rgba(0,0,0,0.5)]">
          {results.map((m, i) => (
            <button
              key={i}
              type="button"
              className="block w-full rounded-md px-2 py-1.5 text-left text-[0.78rem] hover:bg-surface-3"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
            >
              <span className="font-mono">{m.label}</span>
              <span className="ml-1.5 text-[0.68rem] text-dim">
                {m.kind === 'field' ? `${m.entityLabel} · field` : 'entity'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
