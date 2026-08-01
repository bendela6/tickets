// The diagram's outline: a filter box over a tree of groups and the tables
// inside them.
//
// This is the model's table of contents, so it belongs beside the model's other
// navigation rather than in the canvas toolbar — on /schema it is rendered into
// the app shell's mode panel, under the database picker. That is why every
// context read here is the null-tolerant variant: the same panel component
// mounts on routes where no <DiagramProvider> exists, and this must render
// nothing there instead of throwing.

import { useCallback, useMemo, useState } from 'react';

import { cn } from '@tickets/ui';
import {
  useDiagramActionsOrNull,
  useDiagramModelOrNull,
  useDiagramUiOrNull,
} from '../../state/diagram-context';
import { buildOutline } from './build-outline';
import { GroupNode } from './group-node';
import { KindFilters } from './kind-filters';

export function Outline() {
  const model = useDiagramModelOrNull();
  const ui = useDiagramUiOrNull();
  const actions = useDiagramActionsOrNull();

  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());

  const nodes = useMemo(() => (model ? buildOutline(model, query) : []), [model, query]);

  // While filtering, every surviving group is forced open: buildOutline has
  // already pruned the tree to matches, so a collapsed group would hide the
  // very rows the query asked for.
  const filtering = query.trim().length > 0;
  const isOpen = useCallback(
    (id: string) => filtering || !collapsed.has(id),
    [filtering, collapsed],
  );
  const onToggle = useCallback(
    (id: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [],
  );

  if (!model || !ui || !actions) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <input
        type="text"
        name="eer-outline-filter"
        value={query}
        placeholder="Filter tables…"
        aria-label="Filter tables"
        autoComplete="off"
        spellCheck={false}
        className={cn(
          'w-full rounded-md border-1 border-gray-6 bg-gray-2 px-2 py-1.5 text-12 text-gray-12',
          'outline-none placeholder:text-gray-9 focus:border-gray-7',
        )}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('');
        }}
      />

      <p className="px-1 text-11 text-gray-11">
        {model.entities.length} tables · {model.relationships.length} relationships
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {nodes.length === 0 ? (
          <p className="px-1 py-2 text-12 text-gray-11">No tables match.</p>
        ) : (
          nodes.map((n) => (
            <GroupNode key={n.group.id} node={n} isOpen={isOpen} onToggle={onToggle} />
          ))
        )}
      </div>

      <KindFilters />
    </div>
  );
}
