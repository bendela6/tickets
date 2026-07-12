import { memo, type CSSProperties } from 'react';
import type { Entity } from '../../../engine/model/types';
import { FieldRow } from './field-row';

interface EntityCardProps {
  entity: Entity;
  color: string;
  dim: boolean;
  focus: boolean;
  selected: boolean;
  hidden: boolean;
  connected: ReadonlySet<string>;
  pinSpan: ReadonlyMap<string, number>;
}

export const EntityCard = memo(function EntityCard(p: EntityCardProps) {
  const e = p.entity;
  const cls = ['card', p.dim && 'dim', p.focus && 'focus', p.selected && 'selected', p.hidden && 'hidden']
    .filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      data-entity={e.id}
      data-group={e.group}
      style={{ width: e._w, transform: `translate(${e.x}px, ${e.y}px)`, '--entity-c': p.color } as CSSProperties}
    >
      <div className="card-hd"><span className="card-title">{e.label}</span></div>
      <div className="card-body">
        {e.fields.map((f, i) => (
          <FieldRow key={f.name} entity={e} field={f} index={i} connected={p.connected} pinSpan={p.pinSpan} />
        ))}
      </div>
    </div>
  );
});
