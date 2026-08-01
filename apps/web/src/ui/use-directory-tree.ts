import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTreeView, type TreeNode, type UseTreeViewResult } from '@tickets/ui';

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

  // Populated right after `tree` exists, below. `load`'s error branches need
  // to revert the hook's own expansion exception when a load fails — but
  // `load` is referenced by `useTreeView`'s `onExpand` option, which is
  // constructed before `tree` itself exists. A ref breaks that ordering
  // cycle: the closures below only read `treeRef.current` at call time
  // (always after `tree` has been assigned), never at definition time.
  const treeRef = useRef<UseTreeViewResult | null>(null);

  // A node that failed to load must not keep the hook's expansion exception:
  // otherwise `useTreeView`'s internal model still says "expanded" while the
  // rendered row (composed with `!state.error` below) says "collapsed", and
  // arrow-key navigation inside the hook's own `onKeyDown` acts on the
  // model's belief, not on what is on screen (ArrowLeft would try to
  // collapse an already-closed-looking row instead of jumping to the
  // parent). Reverting the exception here — not just patching the render —
  // keeps both in sync AND leaves the node genuinely "not expanded" so the
  // next caret click reads as an expand attempt and retries.
  //
  // Guarded on "was still expanded when this settled": if the user manually
  // collapsed the node while its load was in flight, this must not
  // re-expand it out from under them.
  const revertIfStillExpanded = useCallback((path: string) => {
    const wasExpanded = treeRef.current?.rows.find((r) => r.id === path)?.expanded;
    if (wasExpanded) treeRef.current?.toggle(path);
  }, []);

  const load = useCallback(
    async (path: string) => {
      // Clears any error left from a previous attempt so the retry guard
      // below (in `onExpand`) is deciding from this attempt's state, not a
      // stale one.
      setNodes((n) => ({ ...n, [path]: { ...n[path], loading: true, error: undefined } }));
      try {
        const listing = await queryClient.fetchQuery(workdirDirQuery(path));
        setNodes((n) => ({ ...n, [path]: { entries: listing.entries, error: listing.error, loading: false } }));
        // The API's real error shape (apps/api/src/workdir/workdir-fs.ts) is
        // HTTP 200 with `entries: []` AND an inline `error` — EACCES/EPERM/
        // ENOENT all collapse to this, never a thrown rejection. That path
        // needs the same model-revert as the transport-failure `catch` below.
        if (listing.error) revertIfStillExpanded(path);
      } catch {
        setNodes((n) => ({ ...n, [path]: { error: 'could not read', loading: false } }));
        revertIfStillExpanded(path);
      }
    },
    [queryClient, revertIfStillExpanded],
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
        // NUL is deliberately un-representable in a filesystem path, so this
        // synthetic child id can never collide with a real sibling entry —
        // unlike a plain space, which a directory could legitimately be
        // named with.
        return { id: path, label, children: [{ id: `${path}\u0000empty`, inert: true }] };
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
      const state = nodesRef.current[path];
      // An errored node must be reloadable even when the API's inline-error
      // shape already gave it `entries: []` — an empty array is truthy, so
      // checking only "no entries yet" would treat it as already loaded and
      // never retry.
      if (!state?.entries || state.error) void load(path);
    },
    idPrefix: 'dtree',
  });
  treeRef.current = tree;

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
