import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';

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
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
          // errored nodes drop their cache so a re-expand retries (design rule)
          setNodes((n) => (n[path]?.error ? { ...n, [path]: { loading: false } } : n));
        } else {
          next.add(path);
          setNodes((n) => {
            if (!n[path]?.entries) void load(path);
            return n;
          });
        }
        return next;
      });
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
          out.push({ path: `${path} empty`, label: '', depth: depth + 1, isRoot: false, expanded: false, loading: false, selected: false, focused: false, note: '— empty —' });
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
          if (row?.expanded) toggle(row.path);
          else move(-1);
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
