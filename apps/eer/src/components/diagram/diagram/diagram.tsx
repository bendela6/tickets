import type { ReactNode } from 'react';

import { useDiagramGestures } from '../../../hooks/use-diagram-gestures';
import { useDiagramModelOrNull, useViewportRef } from '../../../state/diagram-context';
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
      className="viewport relative min-w-0 flex-1 cursor-default overflow-hidden bg-bg bg-(image:--dot-grid) bg-size-(--dot-grid-size)"
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
