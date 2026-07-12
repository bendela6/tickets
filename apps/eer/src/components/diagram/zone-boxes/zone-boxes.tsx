import { groupColor } from '../../../engine/colors/group-color';
import { useDiagramModel, useDiagramUi } from '../../../state/diagram-context';
import { cn } from '../../../ui/cn';
import { mix } from '../../../ui/color-mix';
import { runtimeStyle } from '../../../ui/runtime-style';
import { useFocusSets, useHiddenIds } from '../entity-cards';

export function ZoneBoxes() {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const focusSets = useFocusSets();
  const hidden = useHiddenIds();
  const groupFocusId = ui.focus?.type === 'group' ? ui.focus.id : null;
  const lit = groupFocusId ? (focusSets?.litGroups ?? null) : null;
  return (
    <div className="layer groups pointer-events-none absolute left-0 top-0 z-0">
      {model._groupBounds.map((b) => {
        const selected = groupFocusId === b.id;
        const subgroup = b.level > 0;
        const c = groupColor(model, b.id, ui.colors);
        const cls = cn(
          'zone pointer-events-auto absolute left-(--zone-left) top-(--zone-top) h-(--zone-height) w-(--zone-width) cursor-grab rounded-zone border border-dashed border-(--zone-border) bg-(--zone-bg) transition-(--transition-zone) duration-120 data-[resize-cursor=ew-resize]:cursor-ew-resize data-[resize-cursor=nesw-resize]:cursor-nesw-resize data-[resize-cursor=ns-resize]:cursor-ns-resize data-[resize-cursor=nwse-resize]:cursor-nwse-resize active:cursor-grabbing after:pointer-events-none after:absolute after:bottom-1 after:right-1 after:h-2.5 after:w-2.5 after:rounded-br-md after:border-b-2 after:border-r-2 after:border-(--zone-handle) after:opacity-0 after:transition-opacity after:duration-120 hover:after:opacity-100',
          subgroup && 'zone-sub rounded-zone-sub border-solid',
          selected && 'zone-selected border-solid',
          lit && !lit.has(b.id) && 'zone-dim opacity-40',
          hidden.groups.has(b.id) && 'hidden',
        );
        return (
          <div
            key={b.id}
            className={cls}
            data-group={b.id}
            data-parent={b.parent ?? undefined}
            style={runtimeStyle({
              '--zone-left': `${b.x}px`,
              '--zone-top': `${b.y}px`,
              '--zone-width': `${b.w}px`,
              '--zone-height': `${b.h}px`,
              '--group-c': c,
              '--zone-border': selected
                ? subgroup
                  ? mix(c, 55, 'var(--color-border-2)')
                  : mix(c, 65)
                : subgroup
                  ? mix(c, 24, 'var(--color-border)')
                  : mix(c, 30),
              '--zone-bg': mix(c, selected ? (subgroup ? 8 : 11) : subgroup ? 4 : 6),
              '--zone-handle': mix(c, 45),
              '--zone-ink': subgroup ? mix(c, 40, 'var(--color-soft)') : mix(c, 60, 'var(--color-muted)'),
            })}
          >
            <div
              className={cn(
                'zone-label pointer-events-none absolute left-3 top-2 text-sm font-semibold uppercase tracking-wide text-(--zone-ink)',
                subgroup && 'left-2.5 top-1.5 text-2xs font-medium normal-case',
                selected && 'text-ink',
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
