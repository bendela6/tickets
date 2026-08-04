// One group row plus, when expanded, its subgroups and its own entities.
// Recursive: nesting is unbounded in the model, so it is unbounded here too.
//
// Indentation comes from nesting a bordered container rather than a per-depth
// padding class, which keeps the guide line and the offset in one place and
// means no depth→class table to run off the end of.

import { cn } from '@tickets/ui';
import { groupColor } from '../../engine/colors/group-color';
import { zoneIdOf } from '../../engine/groups/zone-id-of';
import { useDiagramActions, useDiagramModel, useDiagramUi } from '../../state/diagram-context';
import { outlineCount, type OutlineEntity, type OutlineNode } from './build-outline';

const indent = 'ml-3 border-l-1 border-gray-6 pl-1';
const dot = 'h-2 w-2 rounded-full';

export function GroupNode({
  node,
  isOpen,
  onToggle,
}: {
  node: OutlineNode;
  isOpen: (groupId: string) => boolean;
  onToggle: (groupId: string) => void;
}) {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const actions = useDiagramActions();

  const g = node.group;
  const open = isOpen(g.id);
  const filled = node.children.length > 0 || node.entities.length > 0;
  // Visibility is a ZONE-level fact: hiddenIds() resolves every entity and box
  // through zoneIdOf, so a subgroup id in the hidden set would be an entry
  // nothing reads. Only zones get the toggle; a subgroup reports its zone's
  // state so a hidden zone's whole subtree reads as off.
  const zone = g.parent == null;
  const hidden = ui.hidden.groups.has(zoneIdOf(model, g.id));
  const selected = ui.panelSelection.type === 'group' && ui.panelSelection.id === g.id;
  const color = groupColor(model, g.id, ui.colors);
  const count = outlineCount(node);

  const swatch = (
    <span
      className={cn(dot, hidden ? 'border-1 border-gray-8' : 'bg-(--group-color)')}
      style={hidden ? undefined : { '--group-color': color }}
    />
  );

  return (
    <div>
      <div className={cn('flex items-center gap-0.5 rounded-md', selected && 'bg-surface-inset')}>
        {filled ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${g.label} subtree`}
            onClick={() => onToggle(g.id)}
            className="flex h-5 w-4 flex-none items-center justify-center rounded-sm text-11 text-gray-11 hover:text-gray-12"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="h-5 w-4 flex-none" />
        )}

        {zone ? (
          <button
            type="button"
            aria-pressed={!hidden}
            aria-label={`${hidden ? 'Show' : 'Hide'} ${g.label}`}
            title={hidden ? `Show ${g.label}` : `Hide ${g.label}`}
            onClick={() => actions.toggleGroup(g.id)}
            className="flex h-5 w-4 flex-none items-center justify-center"
          >
            {swatch}
          </button>
        ) : (
          <span className="flex h-5 w-4 flex-none items-center justify-center">{swatch}</span>
        )}

        <button
          type="button"
          // Spelled out rather than left to the DOM: the label and the count
          // are adjacent spans with no whitespace between them, so the derived
          // accessible name would be "Zone One1".
          aria-label={`${g.label}, ${count} ${count === 1 ? 'table' : 'tables'}`}
          onClick={() => actions.selectGroup(g.id)}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 pl-1 pr-1.5 text-left text-12',
            hidden ? 'text-gray-11 line-through' : 'text-gray-12',
          )}
        >
          <span className="truncate">{g.label}</span>
          <span className="ml-auto flex-none text-11 tabular-nums text-gray-11">{count}</span>
        </button>
      </div>

      {open && filled && (
        <div className={indent}>
          {node.children.map((c) => (
            <GroupNode key={c.group.id} node={c} isOpen={isOpen} onToggle={onToggle} />
          ))}
          {node.entities.map((e) => (
            <EntityRow key={e.entity.id} item={e} hidden={hidden} />
          ))}
        </div>
      )}
    </div>
  );
}

// A table. Clicking it does what picking a search result used to: select it,
// and pan the canvas to it — a name in a list is no use if you then have to
// find the card yourself.
//
// `hidden` (its zone is toggled off) is struck through, matching the group row.
// The click still works — the detail panel is worth reaching either way — but
// without the strikethrough the canvas appears not to respond at all, since
// there is no card there to pan to.
function EntityRow({ item, hidden }: { item: OutlineEntity; hidden: boolean }) {
  const ui = useDiagramUi();
  const actions = useDiagramActions();
  const { entity, columns } = item;
  const selected = ui.panelSelection.type === 'entity' && ui.panelSelection.id === entity.id;

  return (
    <div>
      <button
        type="button"
        title={entity.id}
        onClick={() => actions.focusFromSearch(entity.id)}
        className={cn(
          'flex w-full rounded-md px-1.5 py-1 text-left font-mono text-12 hover:bg-surface-inset hover:text-gray-12',
          selected ? 'bg-surface-inset text-gray-12' : 'text-gray-11',
          hidden && 'line-through',
        )}
      >
        <span className="truncate">{entity.label}</span>
      </button>

      {columns.length > 0 && (
        <div className={indent}>
          {columns.map((c) => {
            const lit = ui.fieldHighlight?.entityId === entity.id && ui.fieldHighlight.field === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => actions.focusFromSearch(entity.id, c)}
                className={cn(
                  'flex w-full rounded-md px-1.5 py-0.5 text-left font-mono text-11 hover:bg-surface-inset hover:text-gray-12',
                  lit ? 'bg-surface-inset text-gray-12' : 'text-gray-11',
                )}
              >
                <span className="truncate">{c}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
