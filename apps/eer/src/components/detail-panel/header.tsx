import type { ReactNode } from 'react';

import { cn } from '@tickets/ui';
import { btn } from '../top-bar/button-class';
import { Badge, type Tone } from './badge';
import { Dot } from './dot';

const editBtn = cn(btn, 'ml-auto px-2 py-1 text-xs');

// Sticky panel header shared by every view. `onEdit` is only passed by views
// that have an editor modal to open (entity/group) — edges are derived, not
// hand-edited, so EdgeDetail never passes it and no button renders.
export function Header({
  tone,
  badge,
  title,
  titleColor,
  sub,
  description,
  onEdit,
}: {
  tone: Tone;
  badge: string;
  title: string;
  titleColor?: string;
  sub: ReactNode;
  description?: string | null;
  onEdit?: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-gray-600 bg-gray-900 px-4 pb-3 pt-4">
      <div className="mb-2 flex items-center gap-2">
        <Badge tone={tone}>{badge}</Badge>
        {titleColor && <Dot color={titleColor} />}
        {onEdit && (
          <button type="button" className={editBtn} onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
      <h2 className="font-mono text-lg font-medium leading-tight text-gray-50">{title}</h2>
      <div className="mt-1 text-xs text-gray-400">{sub}</div>
      {description && <p className="mt-2 text-sm leading-relaxed text-gray-200">{description}</p>}
    </div>
  );
}
