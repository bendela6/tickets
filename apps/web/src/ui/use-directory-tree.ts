import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [nodes, setNodes] = useState<Record<string, NodeState>>({});
  const [focus, setFocus] = useState<string | null>(roots[0]?.path ?? null);

  // Mirrors of the latest state for reads inside `toggle`, so the decision of
  // "expand vs collapse, load vs reuse" is made from fresh state BEFORE any
  // setState call, never from inside a nested state-updater body (those must
  // stay pure — StrictMode double-invokes them, which would double-fire `load`).
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Consumers supply `roots` from an async query that starts empty; sync the
  // initial focus once roots arrive instead of only at mount. Never clobbers
  // a focus the user (or keyboard nav) already set.
  useEffect(() => {
    if (focus == null && roots[0]) setFocus(roots[0].path);
  }, [focus, roots]);

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

  const toggle = useCallback(
    (path: string) => {
      // Decide BEFORE touching state. Reading refs here (not the `expanded`/
      // `nodes` closed over by this render) means the decision reflects the
      // latest committed state even when this callback is invoked more than
      // once (e.g. StrictMode), and `load` below runs exactly once, outside
      // any updater body.
      const isExpanded = expandedRef.current.has(path);
      if (isExpanded) {
        const hadError = Boolean(nodesRef.current[path]?.error);
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(path);
          return next;
        });
        // errored nodes drop their cache so a re-expand retries (design rule)
        if (hadError) {
          setNodes((n) => ({ ...n, [path]: { loading: false } }));
        }
      } else {
        const needsLoad = !nodesRef.current[path]?.entries;
        setExpanded((prev) => {
          const next = new Set(prev);
          next.add(path);
          return next;
        });
        if (needsLoad) void load(path);
      }
    },
    [load],
  );

  const select = useCallback((path: string) => { setFocus(path); onSelect(path); }, [onSelect]);

  const rows = useMemo<VisibleRow[]>(() => {
    const out: VisibleRow[] = [];
    const walk = (path: string, depth: number, root?: WorkdirRoot) => {
      const state = nodes[path];
      const isExpanded = expanded.has(path) && !state?.error;
      out.push({
        path,
        label: root ? root.symbol : basename(path),
        depth,
        isRoot: Boolean(root),
        symbol: root?.symbol,
        annotation: root?.annotation,
        expanded: isExpanded,
        loading: Boolean(state?.loading),
        error: state?.error,
        selected: selected === path,
        focused: focus === path,
      });
      if (isExpanded && state?.entries) {
        if (state.entries.length === 0) {
          out.push({ path: `${path}\u0000empty`, label: '', depth: depth + 1, isRoot: false, expanded: false, loading: false, selected: false, focused: false, note: '— empty —' });
        } else {
          for (const child of state.entries) walk(child.path, depth + 1);
        }
      }
    };
    for (const root of roots) walk(root.path, 0, root);
    return out;
  }, [roots, nodes, expanded, selected, focus]);

  const interactive = useMemo(() => rows.filter((r) => !r.note), [rows]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const i = interactive.findIndex((r) => r.path === focus);
      const move = (delta: number) => {
        const next = interactive[Math.max(0, Math.min(interactive.length - 1, i + delta))];
        if (next) setFocus(next.path);
      };
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); move(1); break;
        case 'ArrowUp': e.preventDefault(); move(-1); break;
        case 'Home': e.preventDefault(); if (interactive[0]) setFocus(interactive[0].path); break;
        case 'End': e.preventDefault(); { const last = interactive.at(-1); if (last) setFocus(last.path); } break;
        case 'ArrowRight': {
          e.preventDefault();
          const row = interactive[i];
          if (row && !row.expanded) toggle(row.path);
          else move(1);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const row = interactive[i];
          if (row?.expanded) {
            toggle(row.path);
          } else if (row) {
            // Parent is the nearest PRECEDING row with a strictly smaller depth —
            // NOT `move(-1)`, which would land on the previous visible row (a
            // sibling, when one exists) instead of the actual parent. If none is
            // found (already at a root), stay put.
            for (let j = i - 1; j >= 0; j--) {
              const candidate = interactive[j];
              if (candidate && candidate.depth < row.depth) {
                setFocus(candidate.path);
                break;
              }
            }
          }
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (focus) select(focus);
          break;
        }
        default:
          if (e.key.length === 1 && /[a-z0-9]/i.test(e.key)) {
            const start = i + 1;
            const found = [...interactive.slice(start), ...interactive.slice(0, start)].find((r) => r.label.toLowerCase().startsWith(e.key.toLowerCase()));
            if (found) { e.preventDefault(); setFocus(found.path); }
          }
      }
    },
    [interactive, focus, toggle, select],
  );

  return { rows, toggle, select, focus, setFocus, onKeyDown };
}
