import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTreeView, type TreeNode } from '@tickets/ui';

import { workdirDirQuery } from '../api/use-workdir-dirs';
import type { WorkdirDirEntry, WorkdirRoot } from '../api/types';

export interface VisibleRow {
  path: string;
  label: string;
  depth: number;
  isRoot: boolean;
  symbol?: string;
  annotation?: string;
  expanded: boolean;
  loading: boolean;
  error?: string;
  selected: boolean;
  focused: boolean;
  note?: '— empty —';
}

type NodeState = { entries?: WorkdirDirEntry[]; error?: string; loading: boolean };

function basename(p: string): string {
  const parts = p.split(/[/\\]/).filter(Boolean);
  return parts.at(-1) ?? p;
}

export function useDirectoryTree(opts: {
  roots: WorkdirRoot[];
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const { roots, selected, onSelect } = opts;
  const queryClient = useQueryClient();
  const [nodes, setNodes] = useState<Record<string, NodeState>>({});
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const load = useCallback(
    async (path: string) => {
      setNodes((n) => ({ ...n, [path]: { ...n[path], loading: true } }));
      try {
        const listing = await queryClient.fetchQuery(workdirDirQuery(path));
        setNodes((n) => ({ ...n, [path]: { entries: listing.entries, error: listing.error, loading: false } }));
      } catch {
        setNodes((n) => ({ ...n, [path]: { error: 'could not read', loading: false } }));
      }
    },
    [queryClient],
  );

  // An errored node reports NO children, so useTreeView will ask to load again
  // on the next expand — which is the retry rule, expressed as data rather
  // than as a special case in a toggle handler.
  const treeRoots = useMemo<TreeNode[]>(() => {
    // `label` carries the typeahead affordance (WAI-ARIA first-letter jump):
    // a root row types against its symbol, everything else against its
    // basename — the same string the pre-migration code typed against.
    const build = (path: string, label: string): TreeNode => {
      const state = nodes[path];
      if (state?.error) return { id: path, label };
      if (!state?.entries) return { id: path, label };
      if (state.entries.length === 0) {
        return { id: path, label, children: [{ id: `${path} empty`, inert: true }] };
      }
      return { id: path, label, children: state.entries.map((e) => build(e.path, basename(e.path))) };
    };
    return roots.map((r) => build(r.path, r.symbol));
  }, [roots, nodes]);

  const tree = useTreeView({
    roots: treeRoots,
    selectedId: selected,
    onSelect,
    onExpand: (path) => {
      if (!nodesRef.current[path]?.entries) void load(path);
    },
    idPrefix: 'dtree',
  });

  const rootByPath = useMemo(() => new Map(roots.map((r) => [r.path, r])), [roots]);

  const rows = useMemo<VisibleRow[]>(
    () =>
      tree.rows.map((r) => {
        if (r.inert) {
          return {
            path: r.id,
            label: '',
            depth: r.depth,
            isRoot: false,
            expanded: false,
            loading: false,
            selected: false,
            focused: false,
            note: '— empty —',
          };
        }
        const root = rootByPath.get(r.id);
        const state = nodes[r.id];
        return {
          path: r.id,
          label: root ? root.symbol : basename(r.id),
          depth: r.depth,
          isRoot: Boolean(root),
          symbol: root?.symbol,
          annotation: root?.annotation,
          // `useTreeView` only knows the user asked to expand this node — it
          // has no error concept. An errored node must still render CLOSED
          // (collapsed caret, aria-expanded=false) even though the "expand"
          // exception is recorded, because there is nothing under it to show.
          expanded: r.expanded && !state?.error,
          loading: Boolean(state?.loading),
          error: state?.error,
          selected: r.selected,
          focused: r.focused,
        };
      }),
    [tree.rows, rootByPath, nodes],
  );

  return {
    rows,
    toggle: tree.toggle,
    select: tree.select,
    focus: tree.focusId,
    setFocus: tree.setFocusId,
    onKeyDown: tree.onKeyDown,
    rowElementId: tree.rowElementId,
    activeDescendant: tree.activeDescendant,
  };
}
