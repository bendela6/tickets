import type { Board } from '../../api/types';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { cn } from '@tickets/ui/cn';
import { Input } from '../../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import type { BoardIndexes } from '../../utils/index-board';
import type { ViewColumn, ViewConfig } from '../../utils/view-config';

type UpdateConfig = (mutate: (current: ViewConfig) => ViewConfig) => void;

export function columnLabel(column: ViewColumn, indexes: BoardIndexes): string {
  if (column.source === 'number') {
    return 'Key';
  }
  if (column.source === 'type') {
    return 'Type';
  }
  if (column.source === 'progress') {
    return 'Subtasks';
  }
  return indexes.fieldByKey.get(column.fieldKey)?.label ?? column.fieldKey;
}

function segmentClasses(active: boolean, withBorder: boolean) {
  return cn(
    'inline-flex h-7.5 cursor-pointer items-center justify-center gap-1.5 font-sans text-meta',
    active ? 'bg-inset font-medium text-ink' : 'text-ink-3 hover:text-ink-2',
    withBorder && 'border-l border-hairline',
  );
}

/** Per-column visibility checkboxes; persists `hidden` into the view config. */
function ColumnChecklist({
  indexes,
  config,
  onUpdate,
}: {
  indexes: BoardIndexes;
  config: ViewConfig;
  onUpdate: UpdateConfig;
}) {
  return (
    <div className="flex min-w-44 flex-col gap-2 p-3">
      {config.columns.map((column, index) => (
        <Checkbox
          key={index}
          label={columnLabel(column, indexes)}
          checked={column.hidden !== true}
          onChange={(event) => {
            const visible = event.target.checked;
            onUpdate((current) => ({
              ...current,
              columns: current.columns.map((entry, entryIndex) =>
                entryIndex === index ? { ...entry, hidden: !visible } : entry,
              ),
            }));
          }}
        />
      ))}
      <div className="-mx-3 my-0.5 h-px bg-hairline" />
      <Checkbox
        label="KPI strip"
        checked={config.kpi}
        onChange={(event) => {
          const kpi = event.target.checked;
          onUpdate((current) => ({ ...current, kpi }));
        }}
      />
    </div>
  );
}

// Board screen header per docs/design/03-project-board.html lines 82–97
// (table mode) and 207–218 (board-mode variant with Columns:/Cards:
// dropdowns). Density/mode/columns all persist into the view config.
export function BoardHeader({
  board,
  indexes,
  ticketCount,
  donePercent,
  query,
  onQueryChange,
  config,
  onUpdate,
}: {
  board: Board;
  indexes: BoardIndexes;
  ticketCount: number;
  donePercent: number;
  query: string;
  onQueryChange: (next: string) => void;
  config: ViewConfig;
  onUpdate: UpdateConfig;
}) {
  const visibleFieldCount = config.columns.filter(
    (column) => column.hidden !== true && column.source === 'field',
  ).length;

  return (
    <div className="mb-3.5 flex shrink-0 flex-wrap items-center gap-3 gap-y-2">
      <span className="rounded-[5px] bg-inset px-1.75 py-0.75 font-mono text-meta font-medium text-ink">
        {board.project.itemPrefix}
      </span>
      <h1 className="m-0 font-sans text-[22px] leading-tight font-semibold text-ink">
        {board.project.name}
      </h1>
      <span className="font-mono text-meta text-ink-3">
        {ticketCount} items · {donePercent}% done
      </span>
      <span className="flex-1" />

      {config.mode === 'table' ? (
        <>
          <Input
            type="search"
            aria-label="Search titles"
            placeholder="Search titles…"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-8 w-full md:w-50"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button size="regular" className="h-8 shrink-0">
                ▦ Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end">
              <ColumnChecklist indexes={indexes} config={config} onUpdate={onUpdate} />
            </PopoverContent>
          </Popover>
          <span
            className="inline-flex shrink-0 overflow-hidden rounded-[8px] border border-hairline"
            title="Density"
          >
            <button
              type="button"
              aria-label="Comfortable density"
              aria-pressed={config.density === 'comfortable'}
              className={cn(segmentClasses(config.density === 'comfortable', false), 'w-8')}
              onClick={() => onUpdate((current) => ({ ...current, density: 'comfortable' }))}
            >
              ☰
            </button>
            <button
              type="button"
              aria-label="Compact density"
              aria-pressed={config.density === 'compact'}
              className={cn(segmentClasses(config.density === 'compact', true), 'w-8')}
              onClick={() => onUpdate((current) => ({ ...current, density: 'compact' }))}
            >
              ≡
            </button>
          </span>
        </>
      ) : (
        <>
          <span className="font-sans text-meta text-ink-2">
            Columns: <strong className="font-medium text-ink">Status</strong>{' '}
            <span aria-hidden className="text-[10px] text-ink-3">
              ▾
            </span>
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="shrink-0 font-sans text-meta text-ink-2">
                Cards:{' '}
                <strong className="font-medium text-ink">
                  {visibleFieldCount} {visibleFieldCount === 1 ? 'field' : 'fields'}
                </strong>{' '}
                <span aria-hidden className="text-[10px] text-ink-3">
                  ▾
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end">
              <ColumnChecklist indexes={indexes} config={config} onUpdate={onUpdate} />
            </PopoverContent>
          </Popover>
        </>
      )}

      <span className="inline-flex shrink-0 overflow-hidden rounded-[8px] border border-hairline">
        <button
          type="button"
          aria-pressed={config.mode === 'table'}
          className={cn(segmentClasses(config.mode === 'table', false), 'px-2.75 font-medium')}
          onClick={() => onUpdate((current) => ({ ...current, mode: 'table' }))}
        >
          ☰ Table
        </button>
        <button
          type="button"
          aria-pressed={config.mode === 'board'}
          className={cn(segmentClasses(config.mode === 'board', true), 'px-2.75 font-medium')}
          onClick={() => onUpdate((current) => ({ ...current, mode: 'board' }))}
        >
          ▦ Board
        </button>
      </span>
    </div>
  );
}
