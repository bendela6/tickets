import { useState, type FormEvent, type ReactNode } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../api/client';
import type { Board, Field, Item, StatusKind } from '../../api/types';
import { usePatchItem } from '../../api/use-patch-item';
import { useProjects } from '../../api/use-projects';
import { KIND_ICON, KIND_TONE, typePill } from '../../domain/status';
import { getCellContent } from '../../registry/get-cell-content';
import { useCurrentUser } from '../../state/current-user-context';
import { Avatar, Button, cn, DialogContent, DialogRoot, DialogTitle, Icon, Input, ItemKey, Menu, MenuContent, MenuItem, MenuTrigger, Pill, RelativeDate, ScreenState, Tabs, toneClasses } from '@tickets/ui';
import { avatarFor } from '../../domain/actor';
import { StatusSelect } from '../../ui/status-select';
import { childProgress } from '../../utils/child-progress';
import { evaluateFilters } from '../../utils/evaluate-filters';
import { indexBoard, type BoardIndexes } from '../../utils/index-board';
import { legalStatusTargets } from '../../utils/legal-status-targets';
import { KpiTiles } from '../board/kpi-strip';
import { ItemDrawer } from '../item-drawer';
import { ColumnsPopover } from './columns-popover';
import { GlobalFilterChips } from './global-filter-chips';
import {
  DEFAULT_GLOBAL_VIEW,
  cloneConfig,
  newViewId,
  readGlobalViews,
  sameConfig,
  toBoardRules,
  writeGlobalViews,
  type GlobalView,
  type GlobalViewConfig,
} from './global-views';
import {
  canonicalColumns,
  columnLabelFor,
  columnWidthFor,
  computeSharedFields,
  defaultColumns,
  isAssigneeish,
  type ProjectEntry,
  type SharedField,
} from './shared-fields';

type Row = { entry: ProjectEntry; ticket: Item };

const KIND_ORDER: { kind: StatusKind; label: string }[] = [
  { kind: 'todo', label: 'To do' },
  { kind: 'active', label: 'Active' },
  { kind: 'blocked', label: 'Blocked' },
  { kind: 'done', label: 'Done' },
  { kind: 'dropped', label: 'Dropped' },
];

// One BoardIndexes per fetched board payload; keyed on the payload object so a
// refetch (new object) re-indexes but re-renders reuse the same maps.
const indexesCache = new WeakMap<Board, BoardIndexes>();
function indexesFor(board: Board): BoardIndexes {
  let indexes = indexesCache.get(board);
  if (!indexes) {
    indexes = indexBoard(board);
    indexesCache.set(board, indexes);
  }
  return indexes;
}

function kindOf(row: Row): StatusKind {
  const workflowField = row.entry.indexes.workflowField(row.ticket.typeId);
  const raw = workflowField ? row.ticket.values[workflowField.key] : undefined;
  const option =
    workflowField && typeof raw === 'string'
      ? row.entry.indexes.optionByValue(workflowField, raw)
      : undefined;
  return option?.kind ?? 'todo';
}

function isPastDate(value: string, now: Date): boolean {
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) {
    return false;
  }
  const dueMidnight = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const nowMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return dueMidnight < nowMidnight;
}

/**
 * Inline status cell ported from board/table-view: the select shows THIS
 * item's board's workflow options filtered by ITS type, and the PATCH goes
 * through use-patch-item, which invalidates every ['board'] query — so the
 * edit lands on the right project no matter which group row it sits in.
 */
function StatusCell({ entry, ticket }: { entry: ProjectEntry; ticket: Item }) {
  const { userId } = useCurrentUser();
  const patch = usePatchItem();
  const queryClient = useQueryClient();
  const workflowField = entry.indexes.workflowField(ticket.typeId);
  if (!workflowField) {
    return null;
  }
  const raw = ticket.values[workflowField.key];
  const statuses = entry.indexes
    .optionsForField(ticket.typeId, workflowField)
    .filter((option) => !option.archivedAt)
    .map((option) => ({ key: option.value, label: option.label, kind: option.kind ?? 'todo' }));
  return (
    <StatusSelect
      size="sm"
      statuses={statuses}
      value={typeof raw === 'string' ? raw : null}
      legalTargets={legalStatusTargets(entry.board, entry.indexes, ticket, ticket.typeId).map(
        (option) => option.value,
      )}
      disabled={userId === null}
      onChange={(next) => {
        if (userId === null || next === raw) {
          return;
        }
        patch.mutate(
          {
            itemId: ticket.id,
            actorId: userId,
            expectedUpdatedAt: ticket.updatedAt,
            values: { [workflowField.key]: next },
          },
          { onError: () => void queryClient.invalidateQueries({ queryKey: ['board'] }) },
        );
      }}
    />
  );
}

/** 'user'-typed field cell: value is a user id (or {id,name}); resolves through the board's users. */
function AssigneeCell({ entry, value }: { entry: ProjectEntry; value: unknown }) {
  const userId =
    typeof value === 'number'
      ? value
      : value !== null && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'number'
        ? (value as { id: number }).id
        : null;
  const user = userId === null ? undefined : entry.indexes.userById.get(userId);
  if (!user) {
    return <span className="font-sans text-13/19 text-gray-9">—</span>;
  }
  return <Avatar name={user.name} {...avatarFor(user.kind)} size="md" />;
}

/** Small dialog for naming a new global view ("＋" tab / saving from the default tab). */
function SaveViewDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length > 0) {
      onSave(name.trim());
      setName('');
    }
  };
  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setName('');
        }
      }}
    >
      <DialogContent>
        <DialogTitle>New global view</DialogTitle>
        <form onSubmit={submit} className="mt-3.5 flex flex-col gap-3.5">
          <Input
            autoFocus
            aria-label="View name"
            placeholder="View name…"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="solid" disabled={name.trim().length === 0}>
              Save view
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

// The ALL ITEMS screen per docs/design/02-all-tickets.html lines 35–184:
// header (title · mono meta · title search · Columns · density), global view
// tabs with an unsaved dot + Group menu, shared-field filter chips, the KPI
// strip, and a table grouped by project (or status kind) whose rows resolve
// every cell through their own project's board and indexes. There is no
// cross-project API — each project's board is fetched with the same query key
// as useBoard and aggregated client-side.
export function AllItemsScreen() {
  const projectsQuery = useProjects();
  const projects = projectsQuery.data?.data ?? [];
  const boardQueries = useQueries({
    queries: projects.map((project) => ({
      queryKey: ['board', project.key],
      queryFn: () => fetchJson<Board>(`/api/projects/${encodeURIComponent(project.key)}/board`),
      staleTime: 30_000,
    })),
  });

  const [views, setViews] = useState<GlobalView[]>(() => readGlobalViews());
  const [activeId, setActiveId] = useState<string>(DEFAULT_GLOBAL_VIEW.id);
  const [config, setConfig] = useState<GlobalViewConfig>(() =>
    cloneConfig(DEFAULT_GLOBAL_VIEW.config),
  );
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ projectKey: string; ticketId: number } | null>(null);
  const [naming, setNaming] = useState(false);

  const entries: ProjectEntry[] = [];
  projects.forEach((project, index) => {
    const board = boardQueries[index]?.data;
    if (board) {
      entries.push({ project, board, indexes: indexesFor(board) });
    }
  });

  const loading =
    projectsQuery.isLoading || (projects.length > 0 && boardQueries.every((q) => !q.data));
  if (loading) {
    return <p className="px-8 py-7 font-sans text-13/19 text-gray-9">Loading all items…</p>;
  }

  const { shared, unshared } = computeSharedFields(entries);
  const sharedByKey = new Map<string, SharedField>(shared.map((field) => [field.key, field]));
  const canonical = canonicalColumns(shared);
  const defaults = defaultColumns(shared);
  const visibleColumns = canonical.filter((id) => (config.columns ?? defaults).includes(id));
  const columnsCustomized = JSON.stringify(visibleColumns) !== JSON.stringify(defaults);

  const activeView = views.find((view) => view.id === activeId) ?? DEFAULT_GLOBAL_VIEW;
  const dirty = !sameConfig(config, activeView.config);

  // Rows: every loaded board's top-level, unarchived items, filtered per
  // project (rules translate field keys → that board's field ids) and searched
  // on the title value only.
  const q = query.trim().toLowerCase();
  let totalCount = 0;
  const allRows: Row[] = [];
  for (const entry of entries) {
    const boardRules = toBoardRules(config.filters, entry.indexes);
    for (const ticket of entry.board.items) {
      if (ticket.archivedAt || ticket.parentId !== null) {
        continue;
      }
      totalCount += 1;
      if (
        q.length > 0 &&
        !String(ticket.values.title ?? '')
          .toLowerCase()
          .includes(q)
      ) {
        continue;
      }
      if (!evaluateFilters(boardRules, '', ticket, entry.indexes)) {
        continue;
      }
      allRows.push({ entry, ticket });
    }
  }

  const kpiCounts: Record<StatusKind, number> = {
    todo: 0,
    active: 0,
    blocked: 0,
    done: 0,
    dropped: 0,
  };
  for (const row of allRows) {
    kpiCounts[kindOf(row)] += 1;
  }

  const groups: { key: string; header: ReactNode; rows: Row[] }[] = [];
  if (config.group === 'project') {
    for (const entry of entries) {
      const rows = allRows
        .filter((row) => row.entry === entry)
        .sort((left, right) => left.ticket.number - right.ticket.number);
      if (rows.length === 0) {
        continue;
      }
      groups.push({
        key: entry.project.key,
        header: (
          <>
            <span className="rounded-[4px] bg-surface-inset px-1.5 py-0.5 font-mono text-11 font-500 text-gray-12">
              {entry.project.itemPrefix}
            </span>
            <span className="font-sans text-13/19 font-500 text-gray-12">{entry.project.name}</span>
            <span className="font-mono text-11 text-gray-9">{rows.length} shown</span>
          </>
        ),
        rows,
      });
    }
  } else {
    const entryOrder = new Map(entries.map((entry, index) => [entry, index]));
    for (const { kind, label } of KIND_ORDER) {
      const textClass = toneClasses(KIND_TONE[kind], 'text');
      const rows = allRows
        .filter((row) => kindOf(row) === kind)
        .sort(
          (left, right) =>
            (entryOrder.get(left.entry) ?? 0) - (entryOrder.get(right.entry) ?? 0) ||
            left.ticket.number - right.ticket.number,
        );
      if (rows.length === 0) {
        continue;
      }
      groups.push({
        key: kind,
        header: (
          <>
            <span className="inline-flex shrink-0">
              <Icon name={KIND_ICON[kind]} tone={KIND_TONE[kind]} size="xs" />
            </span>
            <span className={cn('font-sans text-13/19 font-500', textClass)}>{label}</span>
            <span className="font-mono text-11 text-gray-9">{rows.length} shown</span>
          </>
        ),
        rows,
      });
    }
  }

  const gridTemplateColumns = [
    '96px',
    'minmax(240px, 1fr)',
    ...visibleColumns.map((id) => columnWidthFor(id, sharedByKey)),
  ].join(' ');

  const setColumn = (id: string, visible: boolean) => {
    setConfig((current) => {
      const enabled = new Set(current.columns ?? defaults);
      if (visible) {
        enabled.add(id);
      } else {
        enabled.delete(id);
      }
      return { ...current, columns: canonical.filter((candidate) => enabled.has(candidate)) };
    });
  };

  const selectView = (view: GlobalView) => {
    setActiveId(view.id);
    setConfig(cloneConfig(view.config));
  };

  const createView = (name: string) => {
    const view: GlobalView = { id: newViewId(), name, config: cloneConfig(config) };
    const next = [...views, view];
    setViews(next);
    writeGlobalViews(next);
    setActiveId(view.id);
    setNaming(false);
  };

  const saveToView = () => {
    if (activeId === DEFAULT_GLOBAL_VIEW.id) {
      // the built-in tab is immutable — saving forks a named view
      setNaming(true);
      return;
    }
    const next = views.map((view) =>
      view.id === activeId ? { ...view, config: cloneConfig(config) } : view,
    );
    setViews(next);
    writeGlobalViews(next);
  };

  const selectedEntry = selected
    ? (entries.find((entry) => entry.project.key === selected.projectKey) ?? null)
    : null;
  const selectedTicket =
    selectedEntry && selected
      ? (selectedEntry.indexes.itemById.get(selected.ticketId) ?? null)
      : null;

  const cell = (id: string, row: Row): ReactNode => {
    if (id === 'type') {
      const type = row.entry.indexes.typeById.get(row.ticket.typeId);
      return <Pill {...typePill} label={type?.label ?? '?'} />;
    }
    if (id === 'subs') {
      const { any, done, total } = childProgress(row.ticket, row.entry.indexes);
      if (!any || total === 0) {
        return <span className="font-sans text-13/19 text-gray-9">—</span>;
      }
      return (
        <span className="font-mono text-11 text-gray-11">
          {done}/{total}
        </span>
      );
    }
    const field: Field | undefined = row.entry.indexes.fieldByKey.get(id);
    if (!field) {
      return null;
    }
    if (field.config.workflow === true) {
      return (
        <span onClick={(event) => event.stopPropagation()}>
          <StatusCell entry={row.entry} ticket={row.ticket} />
        </span>
      );
    }
    const value = row.ticket.values[field.key];
    if (isAssigneeish(field)) {
      return <AssigneeCell entry={row.entry} value={value} />;
    }
    if ((field.type === 'date' || field.type === 'datetime') && typeof value === 'string' && value !== '') {
      const kind = kindOf(row);
      return (
        <RelativeDate
          value={value}
          overdue={kind !== 'done' && kind !== 'dropped' && isPastDate(value, new Date())}
        />
      );
    }
    return (
      <span className="min-w-0 truncate font-sans text-13/19 text-gray-11">
        {getCellContent(field, value, row.entry.indexes, row.ticket.typeId)}
      </span>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col px-4 pt-4 md:px-7 md:pt-5.5">
      {/* Header: title · meta · search · columns · density */}
      <div className="mb-3.5 flex shrink-0 flex-wrap items-center gap-3.5 gap-y-2">
        <h1 className="m-0 font-sans text-22 leading-tight font-600 text-gray-12">
          All items
        </h1>
        <span className="font-mono text-12/17 text-gray-9">
          {totalCount} items · {entries.length} projects
        </span>
        <span className="flex-1" />
        <Input
          type="search"
          aria-label="Search titles"
          placeholder="Search titles…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 w-full md:w-55"
        />
        <ColumnsPopover
          projectCount={entries.length}
          shared={shared}
          unshared={unshared}
          enabled={new Set(visibleColumns)}
          customized={columnsCustomized}
          kpi={config.kpi}
          onToggle={setColumn}
          onKpiChange={(kpi) => setConfig((current) => ({ ...current, kpi }))}
        />
        <span title="Density">
          <Tabs variant="pill" role="group"
            items={[
              { value: 'comfortable', icon: 'rows', label: <span className="sr-only">Comfortable density</span> },
              { value: 'compact', icon: 'rows-compact', label: <span className="sr-only">Compact density</span> },
            ]}
            value={config.density}
            onChange={(density) =>
              setConfig((current) => ({ ...current, density: density as GlobalViewConfig['density'] }))
            }
          />
        </span>
      </div>

      {/* Global view tabs + group selector */}
      <div className="mb-3 flex shrink-0 items-center gap-1.5 border-b border-gray-6">
        <Tabs
          className="border-b-0"
          items={[DEFAULT_GLOBAL_VIEW, ...views].map((view) => ({
            value: view.id,
            label: view.name,
            badge:
              view.id === activeId && dirty ? (
                <span aria-hidden title="Unsaved changes" className="inline-block size-1.5 rounded-full bg-orange-9" />
              ) : undefined,
          }))}
          value={activeId}
          onChange={(next) => {
            const view = [DEFAULT_GLOBAL_VIEW, ...views].find((candidate) => candidate.id === next);
            if (view) selectView(view);
          }}
        />
        <button
          type="button"
          aria-label="New global view"
          className="cursor-pointer px-2.5 py-2 font-sans text-13/19 text-gray-9 hover:text-gray-12"
          onClick={() => setNaming(true)}
        >
          ＋
        </button>
        <span className="flex-1" />
        <Menu>
          <MenuTrigger asChild>
            <button type="button" className="cursor-pointer py-2 font-sans text-12/17 text-gray-11">
              Group:{' '}
              <strong className="font-500 text-gray-12">
                {config.group === 'project' ? 'Project' : 'Status kind'}
              </strong>{' '}
              <span aria-hidden className="text-10 text-gray-9">
                <Icon name="chevron-down" size="2xs" />
              </span>
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => setConfig((current) => ({ ...current, group: 'project' }))}>
              Project
            </MenuItem>
            <MenuItem onSelect={() => setConfig((current) => ({ ...current, group: 'kind' }))}>
              Status kind
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <GlobalFilterChips
        sharedFields={shared}
        rules={config.filters}
        dirty={dirty}
        onRulesChange={(next) => setConfig((current) => ({ ...current, filters: next }))}
        onSaveToView={saveToView}
        onReset={() => setConfig(cloneConfig(activeView.config))}
      />

      {config.kpi ? (
        <KpiTiles
          counts={kpiCounts}
          onHide={() => setConfig((current) => ({ ...current, kpi: false }))}
        />
      ) : null}

      <div className="mb-2 shrink-0 font-mono text-12/17 text-gray-9">
        {allRows.length} of {totalCount} match filters
      </div>

      {/* Grouped table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-t-[12px] border border-gray-6 bg-surface-raised">
        <div
          role="row"
          className="sticky top-0 z-10 grid h-9 min-w-170 shrink-0 items-center border-b border-gray-6 bg-gray-1 px-1"
          style={{ gridTemplateColumns }}
        >
          <span className="px-3 font-sans text-11/13 tracking-wider font-500 text-gray-11 uppercase">Key</span>
          <span className="px-2 font-sans text-11/13 tracking-wider font-500 text-gray-11 uppercase">Title</span>
          {visibleColumns.map((id) => (
            <span key={id} className="px-2 font-sans text-11/13 tracking-wider font-500 text-gray-11 uppercase">
              {columnLabelFor(id, sharedByKey)}
            </span>
          ))}
        </div>
        {allRows.length === 0 ? (
          <ScreenState
            className="flex-1 justify-center py-16"
            tone="neutral"
            icon="search"
            title={totalCount > 0 ? 'No items match these filters' : 'No items yet'}
            body={
              totalCount > 0
                ? `Filters are hiding all ${totalCount} items across ${entries.length} projects.`
                : 'Nothing here yet — create an item in any project.'
            }
          />
        ) : (
          groups.map((group) => (
            <div key={group.key} className="min-w-170">
              <div className="flex h-8.5 items-center gap-2.5 border-b border-gray-6 bg-gray-1 px-4">
                {group.header}
              </div>
              {group.rows.map((row) => (
                <div
                  key={`${row.entry.project.key}-${row.ticket.id}`}
                  role="row"
                  onClick={() =>
                    setSelected({ projectKey: row.entry.project.key, ticketId: row.ticket.id })
                  }
                  className={cn(
                    'grid shrink-0 cursor-pointer items-center border-b border-gray-6 px-1 hover:bg-gray-1',
                    config.density === 'compact' ? 'h-8' : 'h-10.5',
                  )}
                  style={{ gridTemplateColumns }}
                >
                  <span className="px-3">
                    <ItemKey prefix={row.entry.project.itemPrefix} number={row.ticket.number} />
                  </span>
                  <span className="truncate px-2 font-sans text-13/19 text-gray-12">
                    {String(row.ticket.values.title ?? '')}
                  </span>
                  {visibleColumns.map((id) => (
                    <span key={id} className="min-w-0 px-2">
                      {cell(id, row)}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {selectedEntry && selectedTicket ? (
        <ItemDrawer
          projectKey={selectedEntry.project.key}
          board={selectedEntry.board}
          indexes={selectedEntry.indexes}
          item={selectedTicket}
          onClose={() => setSelected(null)}
        />
      ) : null}

      <SaveViewDialog open={naming} onOpenChange={setNaming} onSave={createView} />
    </div>
  );
}
