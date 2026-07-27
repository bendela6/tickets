import type { WorkdirRoot } from '../api/types';
import { cn, Spinner } from '@tickets/ui';
import { useDirectoryTree, type VisibleRow } from './use-directory-tree';

function Caret({ open, loading }: { open: boolean; loading: boolean }) {
  if (loading) {
    return <Spinner size={12} tone="primary" />;
  }
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 bg-ink-3 transition-transform', open && 'rotate-90')}
      style={{ clipPath: 'polygon(20% 10%, 20% 90%, 80% 50%)' }}
    />
  );
}

function Row({ row, onToggle, onSelect }: { row: VisibleRow; onToggle: (path: string) => void; onSelect: (path: string) => void }) {
  if (row.note) {
    return (
      <div className="py-1 pr-2 font-mono text-meta italic text-ink-3" style={{ paddingLeft: 8 + row.depth * 16 }}>
        {row.note}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" style={{ paddingLeft: 8 + row.depth * 16 }}>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${row.expanded ? 'collapse' : 'expand'} ${row.path}`}
        onClick={() => onToggle(row.path)}
        className="grid size-4 shrink-0 place-items-center rounded hover:bg-inset"
      >
        <Caret open={row.expanded} loading={row.loading} />
      </button>
      <button
        type="button"
        id={`dtree-${encodeURIComponent(row.path)}`}
        tabIndex={-1}
        role="treeitem"
        aria-expanded={row.expanded}
        aria-selected={row.selected}
        aria-label={row.isRoot ? `${row.symbol} ${row.annotation ?? ''}`.trim() : row.label}
        onClick={() => onSelect(row.path)}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-mono text-meta',
          'hover:bg-inset',
          row.selected && 'bg-accent-subtle font-medium text-accent',
          row.focused && 'outline outline-2 -outline-offset-1 outline-accent',
        )}
      >
        {row.isRoot ? (
          <span className="shrink-0 rounded border border-control px-1 font-mono text-[11px] leading-[15px] text-ink-2">{row.symbol}</span>
        ) : (
          <span
            aria-hidden
            className={cn(
              'size-3 shrink-0 rounded-[2px] border',
              row.error ? 'border-danger' : 'border-folder',
              row.expanded && !row.error && 'bg-folder',
            )}
          />
        )}
        <span className="truncate">{row.isRoot ? row.annotation : row.label}</span>
        {row.error ? <span className="ml-auto shrink-0 font-mono text-[10.5px] text-danger">{row.error}</span> : null}
        {row.selected ? <span className="ml-auto shrink-0 text-accent">✓</span> : null}
      </button>
    </div>
  );
}

export interface DirectoryTreeProps {
  roots: WorkdirRoot[];
  selected: string | null;
  onSelect: (path: string) => void;
}

export function DirectoryTree({ roots, selected, onSelect }: DirectoryTreeProps) {
  const tree = useDirectoryTree({ roots, selected, onSelect });
  return (
    <div
      role="tree"
      tabIndex={0}
      aria-activedescendant={tree.focus ? `dtree-${encodeURIComponent(tree.focus)}` : undefined}
      onKeyDown={tree.onKeyDown}
      className="max-h-[250px] overflow-y-auto rounded-lg bg-inset p-1 outline-none"
    >
      {tree.rows.map((row) => (
        <Row key={row.path} row={row} onToggle={tree.toggle} onSelect={tree.select} />
      ))}
    </div>
  );
}
