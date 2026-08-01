import type { WorkdirRoot } from '../api/types';
import { Spinner, Tree, TreeRow, cn } from '@tickets/ui';
import { useDirectoryTree, type VisibleRow } from './use-directory-tree';

function Row({
  row,
  elementId,
  onToggle,
  onSelect,
}: {
  row: VisibleRow;
  elementId: string;
  onToggle: () => void;
  onSelect: () => void;
}) {
  if (row.note) {
    return (
      <div className="py-1 pr-2 pl-2 font-mono text-12/17 italic text-gray-9">{row.note}</div>
    );
  }

  return (
    <TreeRow
      depth={row.depth}
      expanded={row.expanded}
      hasChildren
      selected={row.selected}
      focused={row.focused}
      elementId={elementId}
      caretLabel={row.path}
      label={row.isRoot ? `${row.symbol} ${row.annotation ?? ''}`.trim() : row.label}
      caret={row.loading ? <Spinner size="sm" tone="primary" /> : undefined}
      leading={
        row.isRoot ? (
          <span className="self-center shrink-0 rounded-sm border-1 border-gray-7 px-1 font-mono text-11 leading-[15px] text-gray-11">
            {row.symbol}
          </span>
        ) : (
          <span
            aria-hidden
            className={cn(
              'size-3 shrink-0 self-center rounded-sm border-1',
              row.error ? 'border-red-9' : 'border-folder',
              row.expanded && !row.error && 'bg-folder',
            )}
          />
        )
      }
      trailing={
        row.error ? (
          <span className="ml-auto shrink-0 font-mono text-11 text-red-9">{row.error}</span>
        ) : row.selected ? (
          <span className="ml-auto shrink-0 text-indigo-9">✓</span>
        ) : null
      }
      onToggle={onToggle}
      onSelect={onSelect}
      className="font-mono text-12/17"
    >
      <span className="truncate">{row.isRoot ? row.annotation : row.label}</span>
    </TreeRow>
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
    <Tree
      activeDescendant={tree.activeDescendant}
      onKeyDown={tree.onKeyDown}
      className="max-h-62 overflow-y-auto rounded-lg bg-surface-inset p-1"
    >
      {tree.rows.map((row) => (
        <Row
          key={row.path}
          row={row}
          elementId={tree.rowElementId(row.path)}
          onToggle={() => tree.toggle(row.path)}
          onSelect={() => tree.select(row.path)}
        />
      ))}
    </Tree>
  );
}
