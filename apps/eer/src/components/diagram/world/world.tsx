import type { ReactNode } from 'react';
import { useDiagramView } from '../../../state/diagram-context';

export function World({ children }: { children: ReactNode }) {
  const v = useDiagramView();
  return (
    <div className="world" style={{ transform: `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})` }}>
      {children}
    </div>
  );
}
