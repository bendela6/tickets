import { type ReactNode, useState } from 'react';

import type { EerDiagram } from '../../engine/eer-diagram';
import type { Model, RoutingMode, SearchResult } from '../../engine/types';
import { cn } from '../../ui/cn';

const ROUTING_LABEL: Record<RoutingMode, string> = {
  curved: 'Lines: curved',
  avoid: 'Lines: avoid',
  ortho: 'Lines: ortho',
};
const ROUTING_TIP: Record<RoutingMode, string> = {
  curved: 'Direct curves (may cross cards)',
  avoid: 'Curves routed around cards',
  ortho: 'Horizontal / vertical only',
};

const btn =
  'border border-border bg-surface text-muted text-[0.74rem] font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap ' +
  'hover:text-ink hover:border-border-2 hover:bg-surface-2';

interface TopBarProps {
  engine: EerDiagram | null;
  model: Model | null;
  routing: RoutingMode;
  onCycleRouting: () => void;
  hiddenGroups: ReadonlySet<string>;
  hiddenKinds: ReadonlySet<string>;
  onToggleGroup: (id: string) => void;
  onToggleKind: (id: string) => void;
  onFit: () => void;
  onRearrange: () => void;
  onSelfCheck: () => void;
}

export function TopBar(props: TopBarProps) {
  const { engine, model } = props;

  return (
    <header className="z-10 flex flex-wrap items-center gap-x-[0.9rem] gap-y-2 border-b border-border bg-[rgba(12,14,20,0.96)] px-4 py-2.5">
      <div className="mr-auto">
        <h1 className="text-[0.98rem] font-semibold tracking-[-0.01em]">{model?.meta.title ?? 'EER model viewer'}</h1>
        <p className="mt-0.5 max-w-[52ch] truncate text-[0.72rem] text-muted">
          {model?.meta.description ??
            (model ? `${model.entities.length} entities · ${model.relationships.length} relationships` : 'loading…')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <SearchBox engine={engine} />

        {model && model.groups.some((g) => !g.parent) && (
          <ToggleGroup label="Zones">
            {model.groups
              .filter((g) => !g.parent)
              .map((g) => (
                <Chip key={g.id} on={!props.hiddenGroups.has(g.id)} onClick={() => props.onToggleGroup(g.id)}>
                  {g.label}
                </Chip>
              ))}
          </ToggleGroup>
        )}

        {model && model.kinds.length > 0 && (
          <ToggleGroup label="Edges">
            {model.kinds.map((k) => (
              <Chip key={k.id} on={!props.hiddenKinds.has(k.id)} onClick={() => props.onToggleKind(k.id)}>
                {k.label}
              </Chip>
            ))}
          </ToggleGroup>
        )}

        <button type="button" className={btn} title={ROUTING_TIP[props.routing]} onClick={props.onCycleRouting}>
          {ROUTING_LABEL[props.routing]}
        </button>
        <button type="button" className={btn} title="Fit the diagram to the viewport" onClick={props.onFit}>
          Fit
        </button>
        <button type="button" className={btn} title="Re-pack entities by zone" onClick={props.onRearrange}>
          Rearrange
        </button>
        <button type="button" className={btn} title="Run the quality checks" onClick={props.onSelfCheck}>
          Self-check
        </button>
      </div>
    </header>
  );
}

function ToggleGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-0.5 text-[0.68rem] uppercase tracking-[0.05em] text-dim">{label}</span>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[0.72rem]',
        on ? 'border-border-2 text-ink' : 'border-border text-muted line-through opacity-45',
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', on ? 'bg-accent' : 'bg-dim')} />
      {children}
    </button>
  );
}

function SearchBox({ engine }: { engine: EerDiagram | null }) {
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
