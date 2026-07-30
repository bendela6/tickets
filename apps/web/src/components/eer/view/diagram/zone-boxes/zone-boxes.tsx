import { groupColor } from '../../../engine/colors/group-color';
import { useDiagramModel, useDiagramUi } from '../../../state/diagram-context';
import { cn, runtimeStyle } from '@tickets/ui';
import { mix } from '../../../ui/color-mix';
import { useFocusSets, useHiddenIds } from '../entity-cards';

export function ZoneBoxes() {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const focusSets = useFocusSets();
  const hidden = useHiddenIds();
  const groupFocusId = ui.focus?.type === 'group' ? ui.focus.id : null;
  const lit = groupFocusId ? (focusSets?.litGroups ?? null) : null;
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-0">
      {model._groupBounds.map((b) => {
        const selected = groupFocusId === b.id;
        const subgroup = b.level > 0;
        const c = groupColor(model, b.id, ui.colors);
        const cls = cn(
          'pointer-events-auto absolute cursor-grab active:cursor-grabbing',
          'left-(--zone-left) top-(--zone-top) h-(--zone-height) w-(--zone-width)',
          'rounded-2xl border border-dashed border-(--zone-border) bg-(--zone-bg)',
          'transition-(--transition-paint) duration-120',
          'data-[resize-cursor=ew-resize]:cursor-ew-resize data-[resize-cursor=ns-resize]:cursor-ns-resize',
          'data-[resize-cursor=nesw-resize]:cursor-nesw-resize',
          'data-[resize-cursor=nwse-resize]:cursor-nwse-resize',
          'after:pointer-events-none after:absolute after:bottom-1 after:right-1 after:h-3 after:w-3',
          'after:rounded-br-md after:border-b-2 after:border-r-2 after:border-(--zone-handle)',
          'after:opacity-0 after:transition-opacity after:duration-120 hover:after:opacity-100',
          {
            'rounded-xl border-solid': subgroup,
            'border-solid': selected,
            'opacity-40': !!lit && !lit.has(b.id),
            'hidden': hidden.groups.has(b.id),
          },
        );
        return (
          <div
            key={b.id}
            className={cls}
            data-zone=""
            data-group={b.id}
            data-parent={b.parent ?? undefined}
            data-selected={selected ? '' : undefined}
            data-dim={lit && !lit.has(b.id) ? '' : undefined}
            style={runtimeStyle({
              '--zone-left': `${b.x}px`,
              '--zone-top': `${b.y}px`,
              '--zone-width': `${b.w}px`,
              '--zone-height': `${b.h}px`,
              '--group-c': c,
              '--zone-border': selected
                ? subgroup
                  ? mix(c, 55, 'var(--color-gray-7)')
                  : mix(c, 65)
                : subgroup
                  ? mix(c, 24, 'var(--color-gray-6)')
                  : mix(c, 30),
              '--zone-bg': mix(c, selected ? (subgroup ? 8 : 11) : subgroup ? 4 : 6),
              '--zone-handle': mix(c, 45),
              '--zone-ink': subgroup ? mix(c, 40, 'var(--color-gray-11)') : mix(c, 60, 'var(--color-gray-11)'),
            })}
          >
            <div
              data-zone-label=""
              className={cn(
                'pointer-events-none absolute left-3 top-2',
                'text-sm font-semibold uppercase tracking-wide text-(--zone-ink)',
                {
                  'text-2xs font-medium normal-case': subgroup,
                  'text-gray-12': selected,
                },
              )}
            >
              {b.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
