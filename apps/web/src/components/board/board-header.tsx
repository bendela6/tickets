import { Button, Checkbox, Icon, Popover, PopoverContent, PopoverTrigger, SearchInput, Tabs, Tooltip } from '@bh/ui';
import type { BoardIndexes } from '../../utils/index-board';
import type { ViewColumn, ViewConfig, ViewDensity, ViewMode } from '../../utils/view-config';
import { KPI_STRIP_DESCRIPTION } from './kpi-strip';

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
        description={KPI_STRIP_DESCRIPTION}
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
// dropdowns). Density/mode/columns all persist into the view config. The
// project's name, its progress and its repository are the page header's
// (routes/project-route.tsx); this is the view's own row of controls.
export function BoardHeader({
  indexes,
  query,
  onQueryChange,
  config,
  onUpdate,
}: {
  indexes: BoardIndexes;
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
      <span className="flex-1" />

      {config.mode === 'table' ? (
        <>
          <SearchInput
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
          <Tooltip content="Density">
            <span>
              <Tabs variant="pill" role="group"
                items={[
                  { value: 'comfortable', icon: 'rows', label: <span className="sr-only">Comfortable density</span> },
                  { value: 'compact', icon: 'rows-compact', label: <span className="sr-only">Compact density</span> },
                ]}
                value={config.density}
                onChange={(density) => onUpdate((current) => ({ ...current, density: density as ViewDensity }))}
              />
            </span>
          </Tooltip>
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
              <Button variant="ghost" tone="neutral" size="sm" chevron className="shrink-0 font-400">
                <span>
                  Cards:{' '}
                  <strong className="font-500 text-gray-12">
                    {visibleFieldCount} {visibleFieldCount === 1 ? 'field' : 'fields'}
                  </strong>
                </span>
              </Button>
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
