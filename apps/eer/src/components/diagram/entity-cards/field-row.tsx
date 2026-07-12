import { useState } from 'react';
import { portKey } from '../../../engine/geometry/port-key';
import { useDiagramDispatch } from '../../../state/diagram-context';
import type { Entity, Field, Side } from '../../../engine/model/types';

function Port({ e, f, side, connected, pinSpan }: {
  e: Entity; f: Field; side: Side; connected: ReadonlySet<string>; pinSpan: ReadonlyMap<string, number>;
}) {
  const key = portKey(e.id, f.name, side);
  const off = pinSpan.get(key) ?? 0;
  return (
    <span
      className={'port ' + (side === 'L' ? 'left' : 'right') + (connected.has(key) ? ' connected' : '')}
      data-entity={e.id}
      data-field={f.name}
      data-side={side}
      style={off > 0 ? { height: 2 * off + 11 } : undefined}
    />
  );
}

export function FieldRow({ entity: e, field: f, index, connected, pinSpan }: {
  entity: Entity; field: Field; index: number; connected: ReadonlySet<string>; pinSpan: ReadonlyMap<string, number>;
}) {
  const dispatch = useDiagramDispatch();
  const [hot, setHot] = useState(false);
  return (
    <div
      className={'field' + (f.role ? ' role-' + f.role : '') + (hot ? ' hot' : '')}
      data-entity={e.id}
      data-field={f.name}
      data-index={String(index)}
      onMouseEnter={() => { setHot(true); dispatch({ type: 'HIGHLIGHT_FIELD', entityId: e.id, field: f.name }); }}
      onMouseLeave={() => { setHot(false); dispatch({ type: 'CLEAR_FIELD_HIGHLIGHT' }); }}
    >
      <span className="badge">{f.role ? f.role.toUpperCase() : ''}</span>
      <span className="fname">{f.name}</span>
      <span className="ftype">{f.type || ''}</span>
      <Port e={e} f={f} side="L" connected={connected} pinSpan={pinSpan} />
      <Port e={e} f={f} side="R" connected={connected} pinSpan={pinSpan} />
    </div>
  );
}
