import { useState } from 'react';
import { columnRoles, type ColumnRole } from '../../../engine/model/column-roles';
import { portKey } from '../../../engine/geometry/port-key';
import { useDiagramDispatch } from '../../../state/diagram-context';
import type { Column, Entity, Side } from '../../../engine/model/types';
import { cn, Pill, runtimeStyle } from '@tickets/ui';

function Port({
  e,
  f,
  role,
  side,
  connected,
  pinSpan,
  hot,
}: {
  e: Entity;
  f: Column;
  role: ColumnRole | undefined;
  side: Side;
  connected: ReadonlySet<string>;
  pinSpan: ReadonlyMap<string, number>;
  hot: boolean;
}) {
  const key = portKey(e.id, f.name, side);
  const off = pinSpan.get(key) ?? 0;
  return (
    <span
      className={cn(
        'absolute top-1/2 z-4 h-4 w-1 -translate-y-1/2',
        'bg-gray-10',
        'transition-(--transition-paint) duration-120',
        connected.has(key) ? 'opacity-100' : 'opacity-0',
        {
          'right-full rounded-l-sm': side === 'L',
          'left-full rounded-r-sm': side === 'R',
          'bg-yellow-9': !!role?.pk,
          'bg-green-9': !role?.pk && !!role?.fk,
          'bg-blue-9 ring-3 ring-blue-9/30': hot,
          'h-(--port-height)': off > 0,
        },
      )}
      data-entity={e.id}
      data-field={f.name}
      data-side={side}
      data-connected={connected.has(key) ? '' : undefined}
      style={off > 0 ? runtimeStyle({ '--port-height': `${2 * off + 11}px` }) : undefined}
    />
  );
}

export function FieldRow({
  entity: e,
  field: f,
  index,
  connected,
  pinSpan,
}: {
  entity: Entity;
  field: Column;
  index: number;
  connected: ReadonlySet<string>;
  pinSpan: ReadonlyMap<string, number>;
}) {
  const dispatch = useDiagramDispatch();
  const [hot, setHot] = useState(false);
  const role = columnRoles(e).get(f.name);
  const badge = role?.pk ? 'pk' : role?.fk ? 'fk' : null;
  return (
    <div
      className="relative flex h-6 cursor-default items-center gap-2 px-3 text-12 hover:bg-surface-inset"
      data-entity={e.id}
      data-field={f.name}
      data-index={String(index)}
      data-role={badge || undefined}
      data-hot={hot ? '' : undefined}
      onMouseEnter={() => {
        setHot(true);
        dispatch({ type: 'HIGHLIGHT_FIELD', entityId: e.id, field: f.name });
      }}
      onMouseLeave={() => {
        setHot(false);
        dispatch({ type: 'CLEAR_FIELD_HIGHLIGHT' });
      }}
    >
      {badge && (
        <Pill
          variant="text"
          size="xs"
          tone={badge === 'pk' ? 'yellow' : 'green'}
          label={badge.toUpperCase()}
          className="shrink-0 justify-center font-mono font-600"
        />
      )}
      <span
        className={cn('truncate font-mono text-gray-12', {
          'text-yellow-9': badge === 'pk',
        })}
      >
        {f.name}
      </span>
      <span className="ml-auto max-w-1/2 truncate font-mono text-11 text-gray-11">
        {f.type || ''}
      </span>
      <Port e={e} f={f} role={role} side="L" connected={connected} pinSpan={pinSpan} hot={hot} />
      <Port e={e} f={f} role={role} side="R" connected={connected} pinSpan={pinSpan} hot={hot} />
    </div>
  );
}
