// One outline row. Flat, not recursive: useTreeView flattens the tree and hands
// this whichever row it is drawing, so nesting is TreeRow's guide columns
// rather than a container this component wraps around its own children.

import { Dot, TreeRow, cn, type TreeRowModel } from '@tickets/ui';
import { groupColor } from '../../engine/colors/group-color';
import { zoneIdOf } from '../../engine/groups/zone-id-of';
import { useDiagramActions, useDiagramModel, useDiagramUi } from '../../state/diagram-context';
import type { OutlineRowData } from './outline-tree';

export function OutlineRow({
  row,
  data,
  elementId,
  onToggle,
  onSelect,
}: {
  row: TreeRowModel;
  data: OutlineRowData;
  elementId: string;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const actions = useDiagramActions();

  const common = {
    depth: row.depth,
    expanded: row.expanded,
    hasChildren: row.hasChildren,
    selected: row.selected,
    focused: row.focused,
    elementId,
    onToggle,
    onSelect,
  };

  if (data.kind === 'group') {
    const g = data.node.group;
    // Visibility is a ZONE-level fact: hiddenIds() resolves every entity and
    // box through zoneIdOf, so a subgroup id in the hidden set would be an
    // entry nothing reads. Only zones get the toggle; a subgroup reports its
    // zone's state so a hidden zone's whole subtree reads as off.
    const zone = g.parent == null;
    const hidden = ui.hidden.groups.has(zoneIdOf(model, g.id));
    const color = groupColor(model, g.id, ui.colors);
    const swatch = <Dot color={color} hollow={hidden} />;

    return (
      <TreeRow
        {...common}
        caretLabel={g.label}
        label={`${g.label}, ${data.count} ${data.count === 1 ? 'table' : 'tables'}`}
        leading={
          zone ? (
            <button
              type="button"
              tabIndex={-1}
              aria-pressed={!hidden}
              aria-label={`${hidden ? 'Show' : 'Hide'} ${g.label}`}
              title={hidden ? `Show ${g.label}` : `Hide ${g.label}`}
              onClick={() => actions.toggleGroup(g.id)}
              className="flex h-5 w-4 flex-none items-center justify-center self-center"
            >
              {swatch}
            </button>
          ) : (
            <span className="flex h-5 w-4 flex-none items-center justify-center self-center">{swatch}</span>
          )
        }
        trailing={
          <span className="ml-auto flex-none text-11 tabular-nums text-gray-11">{data.count}</span>
        }
        className={cn('text-12', hidden ? 'text-gray-11 line-through' : 'text-gray-12')}
      >
        <span className="truncate">{g.label}</span>
      </TreeRow>
    );
  }

  if (data.kind === 'entity') {
    const e = data.entity;
    // A hidden zone's tables strike through with it. The click still works —
    // the detail panel is worth reaching either way — but without this the
    // canvas appears not to respond, since there is no card to pan to.
    const hidden = ui.hidden.groups.has(zoneIdOf(model, e.group));
    return (
      <TreeRow
        {...common}
        caretLabel={e.label}
        label={e.label}
        // `row.selected` also lightens the text — TreeRow's own selected
        // treatment only paints the background (`bg-surface-inset`), which
        // this migration must not be the ONLY selected cue: the pre-migration
        // row paired that background with `text-gray-12`, same as a lit
        // column below.
        className={cn(
          'font-mono text-12',
          row.selected ? 'text-gray-12' : 'text-gray-11',
          hidden && 'line-through',
        )}
      >
        <span className="truncate" title={e.id}>
          {e.label}
        </span>
      </TreeRow>
    );
  }

  const lit =
    ui.fieldHighlight?.entityId === data.entityId && ui.fieldHighlight.field === data.column;
  return (
    <TreeRow
      {...common}
      caretLabel={data.column}
      label={data.column}
      // A lit column pairs a background with the lightened text — text-colour
      // alone reads as a subtle hover, not a "this is the field you searched
      // for" callout.
      className={cn('font-mono text-11', lit ? 'bg-surface-inset text-gray-12' : 'text-gray-11')}
    >
      <span className="truncate">{data.column}</span>
    </TreeRow>
  );
}
