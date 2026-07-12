import { memo } from 'react';
import type { Entity } from '../../../engine/model/types';
import { cn } from '../../../ui/cn';
import { mix } from '../../../ui/color-mix';
import { runtimeStyle } from '../../../ui/runtime-style';
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
  const frame = p.color || 'var(--color-border)';
  const cls = cn(
    'card absolute left-0 top-0 w-(--card-width) translate-x-(--card-x) translate-y-(--card-y) select-none overflow-visible rounded-card border border-(--card-border) bg-surface shadow-card transition-(--transition-card) duration-120',
    p.dim && 'dim opacity-22',
    p.focus && 'focus border-border-2',
    p.selected && 'selected border-accent shadow-card-selected',
    p.hidden && 'hidden',
  );
  return (
    <div
      className={cls}
      data-entity={e.id}
      data-group={e.group}
      style={runtimeStyle({
        '--card-width': `${e._w}px`,
        '--card-x': `${e.x}px`,
        '--card-y': `${e.y}px`,
        '--entity-c': p.color,
        '--card-border': mix(frame, 28, 'var(--color-border)'),
        '--card-hd-border': mix(frame, 22, 'var(--color-border)'),
        '--card-hd-bg': mix(p.color || 'var(--color-surface-2)', 13, 'var(--color-surface-2)'),
        '--card-hd-accent': `inset 0 2px 0 ${p.color || 'transparent'}`,
      })}
    >
      <div className="card-hd flex h-8.5 cursor-grab items-center gap-1.5 rounded-t-card border-b border-(--card-hd-border) bg-(--card-hd-bg) px-2.5 shadow-(--card-hd-accent) active:cursor-grabbing">
        <span className="card-title font-mono text-base font-medium text-ink">{e.label}</span>
      </div>
      <div className="card-body py-0.75">
        {e.fields.map((f, i) => (
          <FieldRow
            key={f.name}
            entity={e}
            field={f}
            index={i}
            connected={p.connected}
            pinSpan={p.pinSpan}
          />
        ))}
      </div>
    </div>
  );
});
