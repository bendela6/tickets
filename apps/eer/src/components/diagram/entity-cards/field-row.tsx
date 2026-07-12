import { useState } from 'react';
import { portKey } from '../../../engine/geometry/port-key';
import { useDiagramDispatch } from '../../../state/diagram-context';
import type { Entity, Field, Side } from '../../../engine/model/types';
import { cn } from '../../../ui/cn';
import { runtimeStyle } from '../../../ui/runtime-style';

function Port({
  e,
  f,
  side,
  connected,
  pinSpan,
  hot,
}: {
  e: Entity;
  f: Field;
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
        'port absolute top-1/2 z-3 h-3.5 w-1.25 -translate-x-1/2 -translate-y-1/2 rounded-xs border border-surface bg-edge opacity-0 transition-(--transition-port) duration-120 before:absolute before:top-1/2 before:h-px before:-translate-y-1/2 before:bg-edge',
        side === 'L'
          ? 'left -left-2 before:left-1/2 before:w-2'
          : 'right left-full ml-2 before:right-1/2 before:w-2',
        connected.has(key) && 'connected opacity-100',
        f.role === 'pk' && 'bg-pk before:bg-pk',
        f.role === 'fk' && 'bg-fk before:bg-fk',
        hot && 'bg-edge-hot shadow-port-glow before:bg-edge-hot',
        off > 0 && 'h-(--port-height)',
      )}
      data-entity={e.id}
      data-field={f.name}
      data-side={side}
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
  field: Field;
  index: number;
  connected: ReadonlySet<string>;
  pinSpan: ReadonlyMap<string, number>;
}) {
  const dispatch = useDiagramDispatch();
  const [hot, setHot] = useState(false);
  return (
    <div
      className={cn(
        'field relative flex h-5.5 cursor-default items-center gap-1.5 px-2.5 text-sm hover:bg-surface-2',
        f.role && `role-${f.role}`,
        hot && 'hot',
      )}
      data-entity={e.id}
      data-field={f.name}
      data-index={String(index)}
      onMouseEnter={() => {
        setHot(true);
        dispatch({ type: 'HIGHLIGHT_FIELD', entityId: e.id, field: f.name });
      }}
      onMouseLeave={() => {
        setHot(false);
        dispatch({ type: 'CLEAR_FIELD_HIGHLIGHT' });
      }}
    >
      <span
        className={cn(
          'badge w-5 shrink-0 text-center font-mono text-3xs font-semibold tracking-wide text-dim',
          f.role === 'pk' && 'text-pk',
          f.role === 'fk' && 'text-fk',
        )}
      >
        {f.role ? f.role.toUpperCase() : ''}
      </span>
      <span
        className={cn(
          'fname truncate whitespace-nowrap font-mono text-ink',
          f.role === 'pk' && 'text-pk',
        )}
      >
        {f.name}
      </span>
      <span className="ftype ml-auto max-w-1/2 truncate whitespace-nowrap font-mono text-xs text-dim">
        {f.type || ''}
      </span>
      <Port e={e} f={f} side="L" connected={connected} pinSpan={pinSpan} hot={hot} />
      <Port e={e} f={f} side="R" connected={connected} pinSpan={pinSpan} hot={hot} />
    </div>
  );
}
