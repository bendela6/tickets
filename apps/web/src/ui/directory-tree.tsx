import type { WorkdirRoot } from '../api/types';
import { cn } from '@tickets/ui';
import { Spinner } from '@tickets/ui';
import { useDirectoryTree, type VisibleRow } from './use-directory-tree';

function Caret({ open, loading }: { open: boolean; loading: boolean }) {
  if (loading) {
    return <Spinner size="sm" tone="primary" />;
  }
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2.5 shrink-0 bg-gray-9 transition-transform', open && 'rotate-90')}
      style={{ clipPath: 'polygon(20% 10%, 20% 90%, 80% 50%)' }}
    />
  );
}

function Row({ row, onToggle, onSelect }: { row: VisibleRow; onToggle: (path: string) => void; onSelect: (path: string) => void }) {
  if (row.note) {
    return (
      <div className="py-1 pr-2 font-mono text-12/17 italic text-gray-9" style={{ paddingLeft: 8 + row.depth * 16 }}>
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
        className="grid size-4 shrink-0 place-items-center rounded-sm hover:bg-surface-inset"
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
          'flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-mono text-12/17',
          'hover:bg-surface-inset',
          row.selected && 'bg-indigo-3 font-500 text-indigo-9',
          row.focused && 'outline outline-2 -outline-offset-1 outline-indigo-9',
        )}
      >
        {row.isRoot ? (
          <span className="shrink-0 rounded-sm border-1 border-gray-7 px-1 font-mono text-11 leading-[15px] text-gray-11">{row.symbol}</span>
        ) : (
          <span
            aria-hidden
            className={cn(
              'size-3 shrink-0 rounded-sm border-1',
              row.error ? 'border-red-9' : 'border-yellow-8',
              row.expanded && !row.error && 'bg-yellow-8',
            )}
          />
        )}
        <span className="truncate">{row.isRoot ? row.annotation : row.label}</span>
        {row.error ? <span className="ml-auto shrink-0 font-mono text-[10.5px] text-red-9">{row.error}</span> : null}
        {row.selected ? <span className="ml-auto shrink-0 text-indigo-9">✓</span> : null}
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
      className="max-h-[250px] overflow-y-auto rounded-lg bg-surface-inset p-1 outline-none"
    >
      {tree.rows.map((row) => (
        <Row key={row.path} row={row} onToggle={tree.toggle} onSelect={tree.select} />
      ))}
    </div>
  );
}
