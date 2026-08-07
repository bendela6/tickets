import type { Board } from '../../api/types';
import { Button, Checkbox, Icon, Input, Popover, PopoverContent, PopoverTrigger, Tabs } from '@tickets/ui';
import type { BoardIndexes } from '../../utils/index-board';
import type { ViewColumn, ViewConfig, ViewDensity, ViewMode } from '../../utils/view-config';

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
    <div className="flex min-w-176 flex-col gap-8 p-12">
      {config.columns.map((column, index) => (
        <Checkbox
          key={index}
          label={columnLabel(column, indexes)}
          value={column.hidden !== true}
          onChange={(next) => {
            const visible = next;
            onUpdate((current) => ({
              ...current,
              columns: current.columns.map((entry, entryIndex) =>
                entryIndex === index ? { ...entry, hidden: !visible } : entry,
              ),
            }));
          }}
        />
      ))}
      <div className="-mx-12 my-2 h-px bg-gray-6" />
      <Checkbox
        label="KPI strip"
        value={config.kpi}
        onChange={(next) => {
          const kpi = next;
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
    <div className="mb-14 flex shrink-0 flex-wrap items-center gap-12 gap-y-8">
      <span className="rounded-6 bg-surface-inset px-7 py-3 font-mono text-12/17 font-500 text-gray-12">
        {board.project.itemPrefix}
      </span>
      <h1 className="m-0 font-sans text-22 leading-tight font-600 text-gray-12">
        {board.project.name}
      </h1>
      <span className="font-mono text-12/17 text-gray-9">
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
            onChange={(next) => onQueryChange(next)}
            className="h-32 w-full md:w-200"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button size="md" className="h-32 shrink-0">
                ▦ Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end">
              <ColumnChecklist indexes={indexes} config={config} onUpdate={onUpdate} />
            </PopoverContent>
          </Popover>
          <span title="Density">
            <Tabs variant="pill" role="group"
              items={[
                { value: 'comfortable', icon: 'rows', label: <span className="sr-only">Comfortable density</span> },
                { value: 'compact', icon: 'rows-compact', label: <span className="sr-only">Compact density</span> },
              ]}
              value={config.density}
              onChange={(density) => onUpdate((current) => ({ ...current, density: density as ViewDensity }))}
            />
          </span>
        </>
      ) : (
        <>
          <span className="font-sans text-12/17 text-gray-11">
            Columns: <strong className="font-500 text-gray-12">Status</strong>{' '}
            <span aria-hidden className="text-10 text-gray-9">
              <Icon name="chevron-down" size="2xs" />
            </span>
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="shrink-0 font-sans text-12/17 text-gray-11">
                Cards:{' '}
                <strong className="font-500 text-gray-12">
                  {visibleFieldCount} {visibleFieldCount === 1 ? 'field' : 'fields'}
                </strong>{' '}
                <span aria-hidden className="text-10 text-gray-9">
                  <Icon name="chevron-down" size="2xs" />
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end">
              <ColumnChecklist indexes={indexes} config={config} onUpdate={onUpdate} />
            </PopoverContent>
          </Popover>
        </>
      )}

      <Tabs variant="pill" role="group"
        items={[
          { value: 'table', label: 'Table', icon: 'rows' },
          { value: 'board', label: 'Board', icon: 'columns' },
        ]}
        value={config.mode}
        onChange={(mode) => onUpdate((current) => ({ ...current, mode: mode as ViewMode }))}
      />
    </div>
  );
}
