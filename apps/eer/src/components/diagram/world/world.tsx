import type { ReactNode } from 'react';
import { useDiagramView } from '../../../state/diagram-context';
import { cn } from '../../../ui/cn';
import { runtimeStyle } from '../../../ui/runtime-style';

export function World({ children }: { children: ReactNode }) {
  const v = useDiagramView();
  return (
    <div
      data-world=""
      className={cn(
        'absolute left-0 top-0 origin-top-left will-change-transform',
        'translate-x-(--world-pan-x) translate-y-(--world-pan-y) scale-(--world-zoom)',
      )}
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
