import { useState } from 'react';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { cn } from '@tickets/ui/cn';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import type { SharedField, UnsharedField } from './shared-fields';
import { canonicalColumns } from './shared-fields';

const BUILT_IN_ROWS = [
  { id: 'type', label: 'Type', typeLabel: 'built-in' },
  { id: 'subs', label: 'Subtasks', typeLabel: 'rollup' },
];

// The 280px columns popover per docs/design/02-all-tickets.html lines 152–176:
// search header, checkbox list of fields shared across every project (field
// type in mono at right), a dimmed "not shared" list with coverage counts, and
// the shared-key explainer footer. The trigger goes accent when the column set
// differs from the default.
export function ColumnsPopover({
  projectCount,
  shared,
  unshared,
  enabled,
  customized,
  kpi,
  onToggle,
  onKpiChange,
}: {
  projectCount: number;
  shared: SharedField[];
  unshared: UnsharedField[];
  enabled: Set<string>;
  customized: boolean;
  kpi: boolean;
  onToggle: (id: string, visible: boolean) => void;
  onKpiChange: (kpi: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const sharedRows = [
    ...BUILT_IN_ROWS,
    ...canonicalColumns(shared)
      .filter((id) => id !== 'type' && id !== 'subs')
      .map((id) => {
        const field = shared.find((candidate) => candidate.key === id);
        return { id, label: field?.label ?? id, typeLabel: field?.type ?? 'field' };
      }),
  ].filter((row) => (q ? row.label.toLowerCase().includes(q) : true));
  const unsharedRows = unshared.filter((field) =>
    q ? field.label.toLowerCase().includes(q) : true,
  );

  return (
    <Popover onOpenChange={(open) => (open ? undefined : setQuery(''))}>
      <PopoverTrigger asChild>
        <Button
          size="regular"
          className={cn(
            'h-8 shrink-0',
            customized &&
              'border-accent bg-accent-subtle text-accent hover:border-accent hover:bg-accent-subtle',
          )}
        >
          ▦ Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-70 p-0">
        <div className="flex items-center gap-2 border-b border-hairline px-3.25 py-2.5">
          <span aria-hidden className="font-sans text-meta text-ink-3">
            ⌕
          </span>
          <input
            aria-label="Find a field"
            placeholder="Find a field…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-ui text-ink placeholder:text-ink-3 focus:outline-none focus:ring-0"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          <div className="px-2.25 pt-1.75 pb-0.75 font-mono text-[10px] font-medium tracking-[0.09em] text-ink-3 uppercase">
            Shared across {projectCount} projects
          </div>
          {sharedRows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-[6px] px-2.25 py-1.5 hover:bg-inset"
            >
              <Checkbox
                label={row.label}
                checked={enabled.has(row.id)}
                onChange={(event) => onToggle(row.id, event.target.checked)}
              />
              <span className="shrink-0 font-mono text-[10px] text-ink-3">{row.typeLabel}</span>
            </div>
          ))}
          {unsharedRows.length > 0 ? (
            <>
              <div className="px-2.25 pt-2.25 pb-0.75 font-mono text-[10px] font-medium tracking-[0.09em] text-ink-3 uppercase">
                Not shared — unavailable here
              </div>
              {unsharedRows.map((field) => (
                <div
                  key={field.key}
                  className="flex items-center gap-2 rounded-[6px] px-2.25 py-1.5 opacity-55"
                >
                  <span
                    aria-hidden
                    className="size-3.75 shrink-0 rounded-[4px] border-[1.5px] border-hairline bg-inset"
                  />
                  <span className="flex-1 truncate font-sans text-ui text-ink-2">
                    {field.label}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-3">
                    {field.coverage} of {projectCount}
                  </span>
                </div>
              ))}
            </>
          ) : null}
          <div className="mx-2.25 my-1.5 h-px bg-hairline" />
          <div className="px-2.25 py-1">
            <Checkbox
              label="KPI strip"
              checked={kpi}
              onChange={(event) => onKpiChange(event.target.checked)}
            />
          </div>
        </div>
        <div className="border-t border-hairline px-3.25 py-2 font-sans text-[11px] text-ink-3">
          A field is shared when the same key exists in every project.
        </div>
      </PopoverContent>
    </Popover>
  );
}
