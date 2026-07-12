import { useState } from 'react';

import type { SearchResult } from '../../engine/model/types';
import { useDiagramActions } from '../../state/diagram-context';

export function SearchBox() {
  const actions = useDiagramActions();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);

  const run = (q: string) => {
    setQuery(q);
    const r = actions.search(q);
    setResults(r);
    setOpen(r.length > 0);
  };

  const pick = (m: SearchResult) => {
    actions.focusFromSearch(m.entityId, m.field);
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
        className="w-48 rounded-md border border-border bg-surface px-2.5 py-1.5 text-base text-ink outline-none placeholder:text-dim focus:border-border-2"
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
        <div className="absolute left-0 top-full z-30 mt-1 max-h-85 min-w-56 overflow-auto rounded-lg border border-border-2 bg-surface-2 p-1 shadow-overlay">
          {results.map((m, i) => (
            <button
              key={i}
              type="button"
              className="block w-full rounded-md px-2 py-1.5 text-left text-base hover:bg-surface-3"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
            >
              <span className="font-mono">{m.label}</span>
              <span className="ml-1.5 text-xs text-dim">
                {m.kind === 'field' ? `${m.entityLabel} · field` : 'entity'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
