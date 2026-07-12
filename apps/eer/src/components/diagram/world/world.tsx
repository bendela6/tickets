import type { ReactNode } from 'react';
import { useDiagramView } from '../../../state/diagram-context';
import { runtimeStyle } from '../../../ui/runtime-style';

export function World({ children }: { children: ReactNode }) {
  const v = useDiagramView();
  return (
    <div
      className="world absolute left-0 top-0 origin-top-left translate-x-(--world-pan-x) translate-y-(--world-pan-y) scale-(--world-zoom) will-change-transform"
      style={runtimeStyle({
        '--world-pan-x': `${v.panX}px`,
        '--world-pan-y': `${v.panY}px`,
        '--world-zoom': v.zoom,
      })}
    >
      {children}
    </div>
  );
}
