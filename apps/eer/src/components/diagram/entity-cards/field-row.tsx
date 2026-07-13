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
        'absolute top-1/2 z-3 h-4 w-1 -translate-y-1/2',
        'bg-gray-300',
        'transition-(--transition-paint) duration-120',
        connected.has(key) ? 'opacity-100' : 'opacity-0',
        {
          'right-full rounded-l-xs': side === 'L',
          'left-full rounded-r-xs': side === 'R',
          'bg-yellow-400': f.role === 'pk',
          'bg-green-400': f.role === 'fk',
          'bg-blue-400 ring-3 ring-blue-400/30': hot,
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
  field: Field;
  index: number;
  connected: ReadonlySet<string>;
  pinSpan: ReadonlyMap<string, number>;
}) {
  const dispatch = useDiagramDispatch();
  const [hot, setHot] = useState(false);
  return (
    <div
      className="relative flex h-6 cursor-default items-center gap-2 px-3 text-sm hover:bg-gray-800"
      data-entity={e.id}
      data-field={f.name}
      data-index={String(index)}
      data-role={f.role || undefined}
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
      {f.role && (
        <span
          className={cn(
            'shrink-0 text-center font-mono text-3xs font-semibold tracking-wide text-gray-400',
            {
              'text-yellow-400': f.role === 'pk',
              'text-green-400': f.role === 'fk',
            },
          )}
        >
          {f.role ? f.role.toUpperCase() : ''}
        </span>
      )}
      <span
        className={cn('truncate font-mono text-gray-50', {
          'text-yellow-400': f.role === 'pk',
        })}
      >
        {f.name}
      </span>
      <span className="ml-auto max-w-1/2 truncate font-mono text-xs text-gray-400">
        {f.type || ''}
      </span>
      <Port e={e} f={f} side="L" connected={connected} pinSpan={pinSpan} hot={hot} />
      <Port e={e} f={f} side="R" connected={connected} pinSpan={pinSpan} hot={hot} />
    </div>
  );
}
