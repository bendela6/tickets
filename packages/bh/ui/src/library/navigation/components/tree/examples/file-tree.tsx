import { useState } from 'react';
import { Tree, TreeRow, useTreeView, type TreeNode } from '@bh/ui';

function nameOf(path: string) {
  return path.split('/').at(-1) ?? path;
}

function file(path: string): TreeNode {
  return { id: path, label: nameOf(path), children: [] };
}

function folder(path: string, children: TreeNode[]): TreeNode {
  return { id: path, label: nameOf(path), children };
}

const ROOTS = [
  folder('src', [
    folder('src/components', [file('src/components/button.tsx'), file('src/components/card.tsx')]),
    file('src/index.ts'),
  ]),
  folder('docs', [file('docs/readme.md')]),
  file('package.json'),
];

export function FileTree() {
  const [selected, setSelected] = useState<string | null>(null);
  const tree = useTreeView({
    roots: ROOTS,
    idPrefix: 'files',
    selectedId: selected,
    onSelect: setSelected,
  });
  return (
    <Tree activeDescendant={tree.activeDescendant} onKeyDown={tree.onKeyDown} className="w-240">
      {tree.rows.map((row) => {
        return (
          <TreeRow
            key={row.id}
            depth={row.depth}
            expanded={row.expanded}
            hasChildren={row.hasChildren}
            selected={row.selected}
            focused={row.focused}
            elementId={tree.rowElementId(row.id)}
            caretLabel={nameOf(row.id)}
            onToggle={() => tree.toggle(row.id)}
            onSelect={() => tree.select(row.id)}
          >
            <span className="text-13/19 truncate">{nameOf(row.id)}</span>
          </TreeRow>
        );
      })}
    </Tree>
  );
}
