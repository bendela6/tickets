import { useState } from 'react';
import { Button, Checkbox, cn, Popover, PopoverContent, PopoverTrigger } from '@tickets/ui';
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
          size="md"
          className={cn(
            'h-32 shrink-0',
            customized &&
              'border-indigo-9 bg-indigo-3 text-indigo-9 hover:border-indigo-9 hover:bg-indigo-3',
          )}
        >
          ▦ Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-280 p-0">
        <div className="flex items-center gap-8 border-b-1 border-gray-6 px-13 py-10">
          <span aria-hidden className="font-sans text-12/17 text-gray-9">
            ⌕
          </span>
          <input
            aria-label="Find a field"
            placeholder="Find a field…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-13/19 text-gray-12 placeholder:text-gray-9 focus:outline-none focus:ring-0"
          />
        </div>
        <div className="max-h-320 overflow-y-auto p-6">
          <div className="px-9 pt-7 pb-3 font-mono text-10 font-500 tracking-[0.09em] text-gray-9 uppercase">
            Shared across {projectCount} projects
          </div>
          {sharedRows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-8 rounded-md px-9 py-6 hover:bg-surface-inset"
            >
              <Checkbox
                label={row.label}
                value={enabled.has(row.id)}
                onChange={(next) => onToggle(row.id, next)}
              />
              <span className="shrink-0 font-mono text-10 text-gray-9">{row.typeLabel}</span>
            </div>
          ))}
          {unsharedRows.length > 0 ? (
            <>
              <div className="px-9 pt-9 pb-3 font-mono text-10 font-500 tracking-[0.09em] text-gray-9 uppercase">
                Not shared — unavailable here
              </div>
              {unsharedRows.map((field) => (
                <div
                  key={field.key}
                  className="flex items-center gap-8 rounded-md px-9 py-6 opacity-55"
                >
                  <span
                    aria-hidden
                    className="size-15 shrink-0 rounded-sm border-2 border-gray-6 bg-surface-inset"
                  />
                  <span className="flex-1 truncate font-sans text-13/19 text-gray-11">
                    {field.label}
                  </span>
                  <span className="shrink-0 font-mono text-10 text-gray-9">
                    {field.coverage} of {projectCount}
                  </span>
                </div>
              ))}
            </>
          ) : null}
          <div className="mx-9 my-6 h-px bg-gray-6" />
          <div className="px-9 py-4">
            <Checkbox
              label="KPI strip"
              value={kpi}
              onChange={(next) => onKpiChange(next)}
            />
          </div>
        </div>
        <div className="border-t-1 border-gray-6 px-13 py-8 font-sans text-11 text-gray-9">
          A field is shared when the same key exists in every project.
        </div>
      </PopoverContent>
    </Popover>
  );
}
