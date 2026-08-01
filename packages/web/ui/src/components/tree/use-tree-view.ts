import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface TreeNode {
  id: string;
  /** Display label. Only consumed here for first-letter typeahead — the
   *  hook never renders anything itself. */
  label?: string;
  /** Materialised children. `undefined` means NOT LOADED — the async seam. */
  children?: TreeNode[];
  /** A row that exists only to say something ("— empty —"). Rendered, but
   *  never focusable and skipped by keyboard navigation. */
  inert?: boolean;
}

export interface TreeRowModel {
  id: string;
  label?: string;
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
  /**
   * Baseline polarity: when true, a node renders expanded unless the user
   * has explicitly collapsed it — the shape a tree that starts fully open
   * needs (e.g. a schema outline), without seeding that via a mount-time
   * loop of `toggle()` calls. `toggle` still ever only records the one node
   * it was called on. Orthogonal to `forceExpanded`, which overrides on top
   * of whichever polarity this picks.
   */
  defaultExpanded?: boolean;
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
 * Tree mechanics: flattening, expansion, roving focus and keyboard navigation
 * — arrow keys, Home/End, Enter/Space and first-letter typeahead, per the
 * WAI-ARIA treeview pattern.
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
  defaultExpanded = false,
  idPrefix,
}: UseTreeViewOptions): UseTreeViewResult {
  // Ids whose expansion differs from `defaultExpanded` — an EXCEPTIONS set,
  // not a literal list of expanded ids. When `defaultExpanded` is false (the
  // common case) membership means "expanded", matching the set's original
  // meaning; when it is true, membership means "collapsed". Either way
  // `toggle` only ever updates the one id it was called on, never a sweep
  // over every node, so switching `defaultExpanded` never needs a mount-time
  // loop of `toggle()` calls.
  const [exceptions, setExceptions] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [focusId, setFocusId] = useState<string | null>(roots[0]?.id ?? null);

  // Mirrors for reads inside `toggle`, so "expand vs collapse, load vs reuse"
  // is decided from fresh state BEFORE any setState — never from inside an
  // updater body. Updater bodies must stay pure: StrictMode double-invokes
  // them, which would fire `onExpand` twice.
  const exceptionsRef = useRef(exceptions);
  exceptionsRef.current = exceptions;
  const rootsRef = useRef(roots);
  rootsRef.current = roots;

  // Consumers supply `roots` from a query that starts empty; seed focus once
  // they arrive rather than only at mount. Never clobbers a focus already set.
  useEffect(() => {
    if (focusId == null && roots[0]) setFocusId(roots[0].id);
  }, [focusId, roots]);

  const rows = useMemo<TreeRowModel[]>(() => {
    const out: TreeRowModel[] = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const n of nodes) {
        // Effective expansion composes three things without mutating any of
        // them: `forceExpanded` overrides on top, `defaultExpanded` sets the
        // baseline polarity, and `exceptions` holds only the ids that differ
        // from that baseline. Turning `forceExpanded` off, or toggling a
        // single node, therefore never discards anything else the user set.
        const isExpanded = forceExpanded || defaultExpanded !== exceptions.has(n.id);
        out.push({
          id: n.id,
          label: n.label,
          depth,
          expanded: isExpanded,
          // `undefined` children mean UNLOADED, so the node still gets a
          // caret — without one it could never be expanded to trigger the
          // load. An inert row never gets one: there is nothing under it to
          // load or reveal.
          hasChildren: !n.inert && (n.children === undefined || n.children.length > 0),
          selected: selectedId === n.id,
          focused: focusId === n.id,
          inert: n.inert === true,
        });
        if (isExpanded && n.children) walk(n.children, depth + 1);
      }
    };
    walk(roots, 0);
    return out;
  }, [roots, exceptions, forceExpanded, defaultExpanded, selectedId, focusId]);

  const navigable = useMemo(() => rows.filter((r) => !r.inert), [rows]);

  const toggle = useCallback(
    (id: string) => {
      // Decide from the EFFECTIVE current state — `forceExpanded` composed
      // with the baseline — NOT from raw exceptions-set membership alone. A
      // click on a row that is only visually open because of `forceExpanded`
      // must be recorded as a collapse; reading set membership on its own
      // inverted the click (the id looked "not an exception" and got ADDED),
      // so turning `forceExpanded` off later left the row open even though
      // the user had just tried to close it.
      const isExpanded = forceExpanded || defaultExpanded !== exceptionsRef.current.has(id);
      const targetExpanded = !isExpanded;
      const needsLoad = targetExpanded && findChildren(rootsRef.current, id) === undefined;
      // Set membership must land on whatever makes the row read as
      // `targetExpanded` once `forceExpanded` is off — an unconditional set,
      // not a flip of current membership, because those diverge exactly when
      // `forceExpanded` was masking the row's real exception state.
      const shouldBeException = defaultExpanded !== targetExpanded;
      setExceptions((prev) => {
        const next = new Set(prev);
        if (shouldBeException) next.add(id);
        else next.delete(id);
        return next;
      });
      if (needsLoad) onExpand?.(id);
    },
    [onExpand, forceExpanded, defaultExpanded],
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
        default: {
          // First-letter typeahead (WAI-ARIA treeview pattern): jump to the
          // next row — wrapping around past the end — whose label starts
          // with the pressed letter. Rows with no label are never a match.
          if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
            const start = i + 1;
            const found = [...navigable.slice(start), ...navigable.slice(0, start)].find((r) =>
              r.label?.toLowerCase().startsWith(e.key.toLowerCase()),
            );
            if (found) {
              e.preventDefault();
              setFocusId(found.id);
            }
          }
          break;
        }
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
