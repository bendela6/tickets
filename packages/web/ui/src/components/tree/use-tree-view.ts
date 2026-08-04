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
  /**
   * Called when expanding a node whose `children` are `undefined` — whether
   * that expansion came from a `toggle()` call or from the node simply
   * rendering expanded (via `defaultExpanded`/`forceExpanded`) while still
   * unloaded. Either way, an effectively-expanded, unloaded node IS a load
   * request. Never called twice for the same id while it stays unloaded and
   * expanded — the hook tracks which ids it has already asked for.
   */
  onExpand?: (id: string) => void;
  /**
   * Render every node expanded, ignoring the collapsed set without discarding
   * it — for a filtered tree, where the caller has already pruned to matches
   * and a collapsed group would hide the very rows the query asked for.
   * Collapsed state is restored when this goes back to false. Composes with
   * the async seam: an unloaded node forced open still fires `onExpand`.
   */
  forceExpanded?: boolean;
  /**
   * Baseline polarity: when true, a node renders expanded unless the user
   * has explicitly collapsed it — the shape a tree that starts fully open
   * needs (e.g. a schema outline), without seeding that via a mount-time
   * loop of `toggle()` calls. `toggle` still ever only records the one node
   * it was called on. Orthogonal to `forceExpanded`, which overrides on top
   * of whichever polarity this picks. Composes with the async seam: an
   * unloaded node that starts open under this still fires `onExpand`.
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

  // Ids `onExpand` has already been asked for, while they remain unloaded and
  // effectively expanded. A ref, not state: writing it must never itself
  // trigger a render, and it is read from inside a `useMemo` body (`toggle`,
  // below) as well as an effect — both need the value as it stood at the
  // instant they ran, not a stale render's closure over state.
  const pendingLoadsRef = useRef<Set<string>>(new Set());

  // Consumers supply `roots` from a query that starts empty; seed focus once
  // they arrive rather than only at mount. Never clobbers a focus already set.
  useEffect(() => {
    if (focusId == null && roots[0]) setFocusId(roots[0].id);
  }, [focusId, roots]);

  const { rows, toLoad, labelById } = useMemo(() => {
    const out: TreeRowModel[] = [];
    const loads: string[] = [];
    const labels = new Map<string, string>();
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const n of nodes) {
        // Effective expansion composes three things without mutating any of
        // them: `forceExpanded` overrides on top, `defaultExpanded` sets the
        // baseline polarity, and `exceptions` holds only the ids that differ
        // from that baseline. Turning `forceExpanded` off, or toggling a
        // single node, therefore never discards anything else the user set.
        const isExpanded = forceExpanded || defaultExpanded !== exceptions.has(n.id);
        // `undefined` children mean UNLOADED, so the node still gets a
        // caret — without one it could never be expanded to trigger the
        // load. An inert row never gets one: there is nothing under it to
        // load or reveal.
        const hasChildren = !n.inert && (n.children === undefined || n.children.length > 0);
        if (n.label !== undefined) labels.set(n.id, n.label);
        // An effectively-expanded, unloaded node is a load request, whether
        // that expansion came from `toggle()` (handled separately, below) or
        // simply from the node rendering open — `defaultExpanded` or
        // `forceExpanded` — while nobody ever clicked its caret. Collected
        // here and fired from an effect, never here: a `useMemo` body must
        // stay a pure read of its inputs, not a place that calls out to the
        // consumer.
        if (isExpanded && !n.inert && n.children === undefined) loads.push(n.id);
        out.push({
          id: n.id,
          depth,
          // A childless node can never be expanded — without this a leaf
          // that starts open under `defaultExpanded` still LOOKS expanded to
          // `onKeyDown`'s ArrowLeft branch, which then toggles the leaf
          // instead of walking to its parent. `TreeRow` already hides the
          // caret and `aria-expanded` for a leaf; this makes the model agree.
          expanded: isExpanded && hasChildren,
          hasChildren,
          selected: selectedId === n.id,
          focused: focusId === n.id,
          inert: n.inert === true,
        });
        if (isExpanded && n.children) walk(n.children, depth + 1);
      }
    };
    walk(roots, 0);
    return { rows: out, toLoad: loads, labelById: labels };
  }, [roots, exceptions, forceExpanded, defaultExpanded, selectedId, focusId]);

  // Fires the load `onExpand` promises for nodes that render open while still
  // unloaded — the `defaultExpanded`/`forceExpanded` case `toggle` never sees,
  // since nobody called it. Runs after commit, not during the memo above,
  // because calling out to the consumer is a side effect.
  //
  // `pendingLoadsRef` guards against re-firing the same id on a later render
  // while its load is still outstanding: `toLoad` is recomputed (and this
  // effect re-runs) on every focus or selection change too, and the
  // consumer's `onExpand` is not guaranteed idempotent. An id drops out of
  // the pending set once it stops needing a load — either the children
  // arrived, or it is no longer effectively expanded — so a genuine reload
  // (the consumer clearing `children` back to `undefined`) can fire again.
  useEffect(() => {
    const stillPending = new Set(toLoad);
    for (const id of pendingLoadsRef.current) {
      if (!stillPending.has(id)) pendingLoadsRef.current.delete(id);
    }
    for (const id of toLoad) {
      if (pendingLoadsRef.current.has(id)) continue;
      pendingLoadsRef.current.add(id);
      onExpand?.(id);
    }
  }, [toLoad, onExpand]);

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
      if (needsLoad) {
        // Mark it pending BEFORE firing, same as the effect does: the render
        // this triggers will recompute `toLoad` with this id still in it
        // (still unloaded, now expanded), and without this the pending-loads
        // effect would fire `onExpand` a second time for the very node this
        // click just requested.
        pendingLoadsRef.current.add(id);
        onExpand?.(id);
      }
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
              labelById.get(r.id)?.toLowerCase().startsWith(e.key.toLowerCase()),
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
    [navigable, focusId, toggle, select, labelById],
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
