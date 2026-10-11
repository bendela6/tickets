---
title: Tree
summary: A hierarchy of rows that expand and collapse, which the keyboard can walk.
related: [Tabs, Spinner]
---

[//]: # 'written from tree.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Tree

A hierarchy of rows that expand and collapse, which the keyboard can walk.

`useTreeView` holds the state: which rows show, and which is expanded,
focused and selected. `Tree` and `TreeRow` draw what it returns, so what
a row shows is yours. It never fetches: a node whose `children` is
`undefined` is not loaded yet, and the hook asks for it with `onExpand`.

## Import

```tsx
import { Tree, TreeRow, useTreeView } from '@bh/ui';
```

## Examples

`useTreeView` flattens the nodes into `rows`, and each row becomes a
`TreeRow`, wired to the hook's `toggle`, `select` and `rowElementId`. A
leaf has `children: []`: a node with no `children` at all gets a caret,
since it may have some once loaded.

**File tree**

```tsx
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
```

Expanding a node whose `children` is `undefined` calls `onExpand` with its
id, once. Give it children on a later render, and `caret` can show a
[Spinner](../../../feedback/components/spinner/spinner.md) until then.

**Loading children**

```tsx
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
```

## Keyboard and accessibility

| Key                | Does                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| `↓` or `↑`         | Moves to the next or the previous row.                                    |
| `→`                | Expands a collapsed row; on an open row or a leaf, moves to the next row. |
| `←`                | Collapses an open row; otherwise moves to its parent.                     |
| `Home` or `End`    | Moves to the first or the last row.                                       |
| `Enter` or `Space` | Selects the focused row.                                                  |
| `A–Z` or `0–9`     | Moves to the next row whose node's `label` starts with that character.    |
| `Tab`              | Moves past the whole tree, which is one tab stop.                         |

The tree keeps focus on itself and points `aria-activedescendant` at the
focused row, so no row is a tab stop. The rows are flat in the DOM, so
each `treeitem` carries `aria-level`, `aria-selected` and, when it can
expand, `aria-expanded`. Its name is its text, or `label`.

The caret is for the mouse, so assistive tech skips it: the arrow keys
expand a row, and its `treeitem` says `aria-expanded`. `leading` sits
outside the `treeitem` too: an icon there is fine, but a control there is
something a tree may not hold, and axe reports it.

## Props

### Tree

| Prop                          | Type                         | Default | Description                                                            |
| ----------------------------- | ---------------------------- | ------- | ---------------------------------------------------------------------- |
| `activeDescendant` (required) | `string`                     |         | The focused row's element id, from `useTreeView`'s `activeDescendant`. |
| `onKeyDown` (required)        | `(e: KeyboardEvent) => void` |         | The keyboard handler, from `useTreeView`'s `onKeyDown`.                |
| `className`                   | `string`                     |         | Added to the tree's classes.                                           |
| `children` (required)         | `ReactNode`                  |         | The rows: one `TreeRow` per row `useTreeView` returns.                 |

### TreeRow

| Prop                     | Type         | Default | Description                                                                                                                                                            |
| ------------------------ | ------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `depth` (required)       | `number`     |         | How deep the row is, from 0 at the roots: one guide line per level.                                                                                                    |
| `expanded` (required)    | `boolean`    |         | Whether its children show. The caret points down when they do.                                                                                                         |
| `hasChildren` (required) | `boolean`    |         | Whether it can expand. When false, the row is a leaf: no caret and no `aria-expanded`.                                                                                 |
| `selected` (required)    | `boolean`    |         | Whether it is the selected row, drawn filled and set as `aria-selected`.                                                                                               |
| `focused` (required)     | `boolean`    |         | Whether it is the row the keyboard is on, drawn with an outline.                                                                                                       |
| `elementId` (required)   | `string`     |         | The treeitem's id, which the tree's `activeDescendant` points at: `rowElementId(id)`.                                                                                  |
| `caretLabel` (required)  | `string`     |         | Labels the caret: "expand <caretLabel>" / "collapse <caretLabel>". The caret is for the mouse and hidden from assistive tech, which expands a row with the arrow keys. |
| `label`                  | `string`     |         | Accessible name for the treeitem. Falls back to its text content.                                                                                                      |
| `caret`                  | `ReactNode`  |         | Replaces the chevron — a Spinner while children load, for instance.                                                                                                    |
| `leading`                | `ReactNode`  |         | Before the treeitem and outside it, so a control here is its own action.                                                                                               |
| `trailing`               | `ReactNode`  |         | After the row's content, inside the treeitem.                                                                                                                          |
| `onToggle` (required)    | `() => void` |         | Called when the caret is clicked.                                                                                                                                      |
| `onSelect` (required)    | `() => void` |         | Called when the row is clicked.                                                                                                                                        |
| `className`              | `string`     |         | Added to the treeitem's classes.                                                                                                                                       |
| `children` (required)    | `ReactNode`  |         | The row's content, inside the treeitem.                                                                                                                                |

### useTreeView

```ts
useTreeView(options: UseTreeViewOptions): UseTreeViewResult
```

Tree mechanics: flattening, expansion, roving focus and keyboard navigation
— arrow keys, Home/End, Enter/Space and first-letter typeahead, per the
WAI-ARIA treeview pattern.

It NEVER fetches. `children: undefined` means "not loaded"; the hook calls
`onExpand(id)` and the consumer supplies children on a later render. That is
what keeps this library free of any data-fetching dependency while still
serving a lazily-loaded tree.

| Parameter                     | Type                   | Default | Description                                                                                      |
| ----------------------------- | ---------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `options` (required)          | `UseTreeViewOptions`   |         |                                                                                                  |
| `options.roots` (required)    | `TreeNode[]`           |         | The top-level nodes.                                                                             |
| `options.selectedId`          | `string \| null`       | `null`  | The selected node's id; the hook marks its row `selected`.                                       |
| `options.onSelect`            | `(id: string) => void` |         | Called with a node's id when it is selected: clicked, or Enter or Space on it.                   |
| `options.onExpand`            | `(id: string) => void` |         | Called with a node's id when it opens with `children` still `undefined`: a request to load them. |
| `options.forceExpanded`       | `boolean`              | `false` | Shows every node expanded, without forgetting which were collapsed: for a filtered tree.         |
| `options.defaultExpanded`     | `boolean`              | `false` | Starts every node expanded, until the reader collapses it.                                       |
| `options.idPrefix` (required) | `string`               |         | Prefix for generated row element ids, so two trees on a page never collide.                      |

Returns `UseTreeViewResult`.

```ts
interface UseTreeViewResult
```

What `useTreeView` returns: the rows to draw, and what to wire them to.

| Member                        | Type                         | Default | Description                                                      |
| ----------------------------- | ---------------------------- | ------- | ---------------------------------------------------------------- |
| `rows` (required)             | `TreeRowModel[]`             |         | The visible rows, in order, flattened: one `TreeRow` each.       |
| `toggle` (required)           | `(id: string) => void`       |         | Expands or collapses a node: a row's `onToggle`.                 |
| `select` (required)           | `(id: string) => void`       |         | Focuses a node and calls `onSelect` with it: a row's `onSelect`. |
| `focusId` (required)          | `string \| null`             |         | The id of the node the keyboard is on.                           |
| `setFocusId` (required)       | `(id: string) => void`       |         | Moves the keyboard to a node.                                    |
| `onKeyDown` (required)        | `(e: KeyboardEvent) => void` |         | The keyboard handler: the tree's `onKeyDown`.                    |
| `activeDescendant` (required) | `string`                     |         | The focused row's element id: the tree's `activeDescendant`.     |
| `rowElementId` (required)     | `(id: string) => string`     |         | A node's element id, from `idPrefix`: a row's `elementId`.       |

```ts
interface TreeNode
```

A node of the tree the hook walks.

| Member          | Type         | Default | Description                                                                                                              |
| --------------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id` (required) | `string`     |         | Unique in the tree: rows, selection and focus are keyed by it.                                                           |
| `label`         | `string`     |         | What first-letter typeahead matches.                                                                                     |
| `children`      | `TreeNode[]` |         | The node's children: `[]` for a leaf, `undefined` while not loaded.                                                      |
| `inert`         | `boolean`    |         | A row that exists only to say something ("— empty —"). Rendered, but never focusable and skipped by keyboard navigation. |
