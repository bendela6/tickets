import { useTreeView, type TreeNode } from './use-tree-view';
import { Tree, TreeRow } from './tree';

export const meta = { title: 'Tree', size: 'md', impl: ['tree.tsx', 'use-tree-view.ts'] };

const ROOTS: TreeNode[] = [
  {
    id: 'core',
    children: [{ id: 'projects' }, { id: 'users' }, { id: 'views' }],
  },
  {
    id: 'terminal',
    children: [{ id: 'output' }, { id: 'sessions' }],
  },
];

function Demo() {
  const tree = useTreeView({ roots: ROOTS, idPrefix: 'demo' });
  return (
    <Tree activeDescendant={tree.activeDescendant} onKeyDown={tree.onKeyDown}>
      {tree.rows.map((r) => (
        <TreeRow
          key={r.id}
          depth={r.depth}
          expanded={r.expanded}
          hasChildren={r.hasChildren}
          selected={r.selected}
          focused={r.focused}
          elementId={tree.rowElementId(r.id)}
          caretLabel={r.id}
          onToggle={() => tree.toggle(r.id)}
          onSelect={() => tree.select(r.id)}
        >
          <span className="truncate font-mono text-12">{r.id}</span>
        </TreeRow>
      ))}
    </Tree>
  );
}

export const states = [{ name: 'Default', render: () => <Demo /> }];
