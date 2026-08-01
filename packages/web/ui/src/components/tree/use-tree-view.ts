import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface TreeNode {
  id: string;
  /** Materialised children. `undefined` means NOT LOADED — the async seam. */
  children?: TreeNode[];
  /** A row that exists only to say something ("— empty —"). Rendered, but
   *  never focusable and skipped by keyboard navigation. */
  inert?: boolean;
}

export interface TreeRowModel {
  id: string;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  selected: boolean;
  focused: boolean;
  inert: boolean;
}

export interface UseTreeViewOptions {
  roots: TreeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Called when expanding a node whose `children` are `undefined`. */
  onExpand?: (id: string) => void;
  /**
   * Render every node expanded, ignoring the collapsed set without discarding
   * it — for a filtered tree, where the caller has already pruned to matches
   * and a collapsed group would hide the very rows the query asked for.
   * Collapsed state is restored when this goes back to false.
   */
  forceExpanded?: boolean;
  /** Prefix for generated row element ids, so two trees on a page never collide. */
  idPrefix: string;
}

export interface UseTreeViewResult {
  rows: TreeRowModel[];
  toggle: (id: string) => void;
  select: (id: string) => void;
  focusId: string | null;
  setFocusId: (id: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  activeDescendant: string | undefined;
  rowElementId: (id: string) => string;
}

/**
 * Tree mechanics: flattening, expansion, roving focus and keyboard navigation.
 *
 * It NEVER fetches. `children: undefined` means "not loaded"; the hook calls
 * `onExpand(id)` and the consumer supplies children on a later render. That is
 * what keeps this library free of any data-fetching dependency while still
 * serving a lazily-loaded tree.
 */
export function useTreeView({
  roots,
  selectedId = null,
  onSelect,
  onExpand,
  forceExpanded = false,
  idPrefix,
}: UseTreeViewOptions): UseTreeViewResult {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [focusId, setFocusId] = useState<string | null>(roots[0]?.id ?? null);

  // Mirrors for reads inside `toggle`, so "expand vs collapse, load vs reuse"
  // is decided from fresh state BEFORE any setState — never from inside an
  // updater body. Updater bodies must stay pure: StrictMode double-invokes
  // them, which would fire `onExpand` twice.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const rootsRef = useRef(roots);
  rootsRef.current = roots;

  // Consumers supply `roots` from a query that starts empty; seed focus once
  // they arrive rather than only at mount. Never clobbers a focus already set.
  useEffect(() => {
    if (focusId == null && roots[0]) setFocusId(roots[0].id);
  }, [focusId, roots]);

  const byId = useMemo(() => {
    const map = new Map<string, TreeNode>();
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        map.set(n.id, n);
        if (n.children) walk(n.children);
      }
    };
    walk(roots);
    return map;
  }, [roots]);

  const rows = useMemo<TreeRowModel[]>(() => {
    const out: TreeRowModel[] = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const n of nodes) {
        // `forceExpanded` overrides the set without mutating it, so turning a
        // filter off restores exactly what the user had collapsed.
        const isExpanded = forceExpanded || expanded.has(n.id);
        out.push({
          id: n.id,
          depth,
          expanded: isExpanded,
          // `undefined` children mean UNLOADED, so the node still gets a caret —
          // without one it could never be expanded to trigger the load.
          hasChildren: n.children === undefined || n.children.length > 0,
          selected: selectedId === n.id,
          focused: focusId === n.id,
          inert: n.inert === true,
        });
        if (isExpanded && n.children) walk(n.children, depth + 1);
      }
    };
    walk(roots, 0);
    return out;
  }, [roots, expanded, forceExpanded, selectedId, focusId]);

  const navigable = useMemo(() => rows.filter((r) => !r.inert), [rows]);

  const toggle = useCallback(
    (id: string) => {
      const isExpanded = expandedRef.current.has(id);
      const needsLoad = !isExpanded && rootsRef.current.length > 0 && findChildren(rootsRef.current, id) === undefined;
      setExpanded((prev) => {
        const next = new Set(prev);
        if (isExpanded) next.delete(id);
        else next.add(id);
        return next;
      });
      if (needsLoad) onExpand?.(id);
    },
    [onExpand],
  );

  const select = useCallback(
    (id: string) => {
      setFocusId(id);
      onSelect?.(id);
    },
    [onSelect],
  );

  const rowElementId = useCallback((id: string) => `${idPrefix}-${encodeURIComponent(id)}`, [idPrefix]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const i = navigable.findIndex((r) => r.id === focusId);
      const move = (delta: number) => {
        const next = navigable[Math.max(0, Math.min(navigable.length - 1, i + delta))];
        if (next) setFocusId(next.id);
      };
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); move(1); break;
        case 'ArrowUp': e.preventDefault(); move(-1); break;
        case 'Home': e.preventDefault(); if (navigable[0]) setFocusId(navigable[0].id); break;
        case 'End': {
          e.preventDefault();
          const last = navigable.at(-1);
          if (last) setFocusId(last.id);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const row = navigable[i];
          if (row && row.hasChildren && !row.expanded) toggle(row.id);
          else move(1);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const row = navigable[i];
          if (!row) break;
          if (row.expanded) {
            toggle(row.id);
            break;
          }
          // The parent is the nearest PRECEDING row of strictly smaller depth —
          // NOT move(-1), which lands on a sibling whenever one exists. If none
          // is found (already at a root), stay put.
          for (let j = i - 1; j >= 0; j--) {
            const candidate = navigable[j];
            if (candidate && candidate.depth < row.depth) {
              setFocusId(candidate.id);
              break;
            }
          }
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (focusId) select(focusId);
          break;
        }
        default:
          break;
      }
    },
    [navigable, focusId, toggle, select],
  );

  return {
    rows,
    toggle,
    select,
    focusId,
    setFocusId,
    onKeyDown,
    activeDescendant: focusId ? rowElementId(focusId) : undefined,
    rowElementId,
  };
}

/** `undefined` when the node is unloaded, an array when it is loaded. */
function findChildren(nodes: TreeNode[], id: string): TreeNode[] | undefined {
  for (const n of nodes) {
    if (n.id === id) return n.children;
    if (n.children) {
      const hit = findChildren(n.children, id);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}
