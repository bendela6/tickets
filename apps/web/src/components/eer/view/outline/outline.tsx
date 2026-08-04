// The diagram's outline: a filter box over a tree of groups and the tables
// inside them.
//
// This is the model's table of contents, so it belongs beside the model's other
// navigation rather than in the canvas toolbar — on /schema it is rendered into
// the app shell's mode panel, under the database picker. That is why every
// context read here is the null-tolerant variant: the same panel component
// mounts on routes where no <DiagramProvider> exists, and this must render
// nothing there instead of throwing.

import { useCallback, useId, useMemo, useState } from 'react';

import { Tree, cn, useTreeView } from '@tickets/ui';
import type { Selection } from '../../engine/model/types';
import {
  useDiagramActionsOrNull,
  useDiagramModelOrNull,
  useDiagramUiOrNull,
} from '../../state/diagram-context';
import { buildOutline } from './build-outline';
import { KindFilters } from './kind-filters';
import { OutlineRow } from './group-node';
import { entityRowId, groupRowId, indexOutline, outlineToTreeNodes, parseRowId } from './outline-tree';

// The tree highlights whatever the CANVAS has selected too, not only what was
// clicked here — one selection, shown in both places.
function selectedRowId(sel: Selection): string | null {
  if (sel.type === 'group') return groupRowId(sel.id);
  if (sel.type === 'entity') return entityRowId(sel.id);
  return null;
}

export function Outline() {
  const model = useDiagramModelOrNull();
  const ui = useDiagramUiOrNull();
  const actions = useDiagramActionsOrNull();

  // app-shell.tsx builds the mode panel ONCE and renders that same element in
  // two places — the desktop column (CSS-hidden below `md`, but still
  // MOUNTED) and the mobile drawer `<aside>` (mounted only while open). Each
  // location instantiates its own <Outline/>, so on /schema at a width where
  // both are mounted, two trees exist in the DOM at once. A literal idPrefix
  // would give them identical row ids, and `aria-activedescendant` resolves
  // by id to the FIRST match in document order — the hidden desktop copy —
  // leaving the visible (mobile) tree's roving focus pointing at an element
  // nobody can see. `useId()` gives every mounted instance its own prefix.
  const uid = useId();

  const [query, setQuery] = useState('');

  const nodes = useMemo(() => (model ? buildOutline(model, query) : []), [model, query]);
  const treeRoots = useMemo(() => outlineToTreeNodes(nodes), [nodes]);
  const index = useMemo(() => indexOutline(nodes), [nodes]);

  const filtering = query.trim().length > 0;

  const onSelect = useCallback(
    (rowId: string) => {
      if (!actions) return;
      const { kind, rest } = parseRowId(rowId);
      if (kind === 'g') {
        actions.selectGroup(rest);
      } else if (kind === 'e') {
        // Selects AND pans — a name in a list is no use if you then have to
        // find the card yourself.
        actions.focusFromSearch(rest);
      } else {
        // `c:<entityId>:<column>` — entity ids are schema-qualified, so the
        // column is after the LAST colon.
        const at = rest.lastIndexOf(':');
        actions.focusFromSearch(rest.slice(0, at), rest.slice(at + 1));
      }
    },
    [actions],
  );

  const tree = useTreeView({
    roots: treeRoots,
    selectedId: ui ? selectedRowId(ui.panelSelection) : null,
    onSelect,
    // buildOutline has already pruned to matches, so a collapsed group would
    // hide the very rows the query asked for. Non-destructive: clearing the
    // filter restores whatever the user had collapsed.
    forceExpanded: filtering,
    // The outline has always started with every group open — a collapsed set
    // seeded empty means "closed" to useTreeView by default, so this flips
    // the baseline polarity instead of that.
    defaultExpanded: true,
    idPrefix: `outline-${uid}`,
  });

  if (!model || !ui || !actions) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <input
        type="text"
        name="eer-outline-filter"
        value={query}
        placeholder="Filter tables…"
        aria-label="Filter tables"
        autoComplete="off"
        spellCheck={false}
        className={cn(
          'w-full rounded-md border-1 border-gray-6 bg-gray-2 px-8 py-6 text-12 text-gray-12',
          'outline-none placeholder:text-gray-9 focus:border-gray-7',
        )}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('');
        }}
      />

      <p className="px-4 text-11 text-gray-11">
        {model.entities.length} tables · {model.relationships.length} relationships
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tree.rows.length === 0 ? (
          <p className="px-4 py-8 text-12 text-gray-11">No tables match.</p>
        ) : (
          <Tree activeDescendant={tree.activeDescendant} onKeyDown={tree.onKeyDown}>
            {tree.rows.map((r) => {
              const data = index.get(r.id);
              if (!data) return null;
              return (
                <OutlineRow
                  key={r.id}
                  row={r}
                  data={data}
                  elementId={tree.rowElementId(r.id)}
                  onToggle={() => tree.toggle(r.id)}
                  onSelect={() => tree.select(r.id)}
                />
              );
            })}
          </Tree>
        )}
      </div>

      <KindFilters />
    </div>
  );
}
