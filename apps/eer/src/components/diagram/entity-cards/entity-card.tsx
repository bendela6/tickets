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
  const frame = p.color || 'var(--color-gray-600)';
  return (
    <div
      className={cn(
        'select-none overflow-visible',
        'absolute left-0 top-0',
        'w-(--card-width) translate-x-(--card-x) translate-y-(--card-y)',
        'border border-(--card-border) rounded-lg',
        'bg-gray-900 shadow-md',
        'transition-(--transition-paint) duration-120',
        {
          'opacity-22': p.dim,
          'border-gray-500': p.focus,
          'border-blue-400 ring-1 ring-blue-400 shadow-lg': p.selected,
          hidden: p.hidden,
        },
      )}
      data-card=""
      data-entity={e.id}
      data-group={e.group}
      data-dim={p.dim ? '' : undefined}
      data-focus={p.focus ? '' : undefined}
      data-selected={p.selected ? '' : undefined}
      style={runtimeStyle({
        '--card-width': `${e._w}px`,
        '--card-x': `${e.x}px`,
        '--card-y': `${e.y}px`,
        '--entity-c': p.color,
        '--card-border': mix(frame, 28, 'var(--color-gray-600)'),
        '--card-hd-border': mix(frame, 22, 'var(--color-gray-600)'),
        '--card-hd-bg': mix(p.color || 'var(--color-gray-800)', 13, 'var(--color-gray-800)'),
      })}
    >
      <div
        className={cn(
          'rounded-t-lg cursor-grab active:cursor-grabbing',
          'flex items-center gap-2',
          'h-9 px-3',
          'border-b border-(--card-hd-border)',
          'bg-(--card-hd-bg)',
        )}
      >
        <span className="font-mono text-base font-medium text-gray-50">{e.label}</span>
      </div>
      <div className="py-1">
        {e.columns.map((f, i) => (
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
