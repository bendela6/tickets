import type { CSSProperties } from 'react';
import { groupColor } from '../../../engine/colors/group-color';
import { useDiagramModel, useDiagramUi } from '../../../state/diagram-context';
import { useFocusSets, useHiddenIds } from '../entity-cards';

export function ZoneBoxes() {
  const model = useDiagramModel();
  const ui = useDiagramUi();
  const focusSets = useFocusSets();
  const hidden = useHiddenIds();
  const groupFocusId = ui.focus?.type === 'group' ? ui.focus.id : null;
  const lit = groupFocusId ? (focusSets?.litGroups ?? null) : null;
  return (
    <div className="layer groups">
      {model._groupBounds.map((b) => {
        const cls = [
          'zone',
          b.level > 0 && 'zone-sub',
          groupFocusId === b.id && 'zone-selected',
          lit && !lit.has(b.id) && 'zone-dim',
          hidden.groups.has(b.id) && 'hidden',
        ].filter(Boolean).join(' ');
        return (
          <div
            key={b.id}
            className={cls}
            data-group={b.id}
            data-parent={b.parent ?? undefined}
            style={{ left: b.x, top: b.y, width: b.w, height: b.h, '--group-c': groupColor(model, b.id, ui.colors) } as CSSProperties}
          >
            <div className="zone-label">{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}
