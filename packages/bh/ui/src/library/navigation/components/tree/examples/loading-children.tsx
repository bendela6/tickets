import { useState } from 'react';
import { Spinner, Tree, TreeRow, useTreeView, type TreeNode } from '@bh/ui';

const CONTENTS: Record<string, string[]> = {
  photos: ['beach.jpg', 'city.jpg'],
  music: ['song.mp3'],
};

export function LoadingChildren() {
  const [loaded, setLoaded] = useState<Record<string, TreeNode[]>>({});
  // `children: undefined` means not loaded yet.
  const roots = Object.keys(CONTENTS).map((name) => {
    return { id: name, label: name, children: loaded[name] };
  });
  const tree = useTreeView({
    roots,
    idPrefix: 'lazy',
    onExpand: (id) => {
      setTimeout(() => {
        const children = (CONTENTS[id] ?? []).map((name) => {
          return { id: `${id}/${name}`, label: name, children: [] };
        });
        setLoaded((current) => ({ ...current, [id]: children }));
      }, 1000);
    },
  });
  return (
    <Tree activeDescendant={tree.activeDescendant} onKeyDown={tree.onKeyDown} className="w-240">
      {tree.rows.map((row) => {
        const loading = row.expanded && row.depth === 0 && loaded[row.id] === undefined;
        return (
          <TreeRow
            key={row.id}
            depth={row.depth}
            expanded={row.expanded}
            hasChildren={row.hasChildren}
            selected={row.selected}
            focused={row.focused}
            elementId={tree.rowElementId(row.id)}
            caretLabel={row.id}
            caret={loading ? <Spinner size="xs" /> : undefined}
            onToggle={() => tree.toggle(row.id)}
            onSelect={() => tree.select(row.id)}
          >
            <span className="text-13/19 truncate">{row.id.split('/').at(-1)}</span>
          </TreeRow>
        );
      })}
    </Tree>
  );
}
