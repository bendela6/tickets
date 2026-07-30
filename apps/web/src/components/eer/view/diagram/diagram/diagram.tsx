import type { ReactNode } from 'react';

import { useDiagramGestures } from '../../../hooks/use-diagram-gestures';
import { useDiagramModelOrNull, useViewportRef } from '../../../state/diagram-context';
import { cn, runtimeStyle } from '@tickets/ui';
import { EdgesSvg } from '../edges-svg';
import { EntityCards } from '../entity-cards';
import { World } from '../world';
import { ZoneBoxes } from '../zone-boxes';

export function Diagram({ children }: { children?: ReactNode }) {
  const viewportRef = useViewportRef();
  const model = useDiagramModelOrNull();
  useDiagramGestures(viewportRef);
  return (
    <div
      ref={viewportRef}
      data-viewport=""
      className={cn(
        'relative min-w-0 flex-1 cursor-default overflow-hidden',
        'bg-gray-1 bg-(image:--dot-grid) bg-size-(--dot-grid-size)',
      )}
      style={runtimeStyle({
        // The grid dot is a hairline-weight structural mark, so it rides the
        // border rung: subtle against gray-1 in both themes, and it flips with
        // [data-theme] where the old hardcoded white never could.
        '--dot-grid': 'radial-gradient(circle at 1px 1px, var(--color-gray-6) 1px, transparent 0)',
        '--dot-grid-size': '26px 26px',
      })}
    >
      {model && (
        <World>
          <ZoneBoxes />
          <EdgesSvg />
          <EntityCards />
        </World>
      )}
      {children}
    </div>
  );
}
