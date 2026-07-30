import type { ReactNode } from 'react';

import { Badge, type Tone } from './badge';
import { Dot } from './dot';

// Sticky panel header shared by every view (entity/group/edge). Read-only —
// there is no edit affordance here; the editor this once opened is gone.
export function Header({
  tone,
  badge,
  title,
  titleColor,
  sub,
  description,
}: {
  tone: Tone;
  badge: string;
  title: string;
  titleColor?: string;
  sub: ReactNode;
  description?: string | null;
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-gray-6 bg-gray-2 px-4 pb-3 pt-4">
      <div className="mb-2 flex items-center gap-2">
        <Badge tone={tone}>{badge}</Badge>
        {titleColor && <Dot color={titleColor} />}
      </div>
      <h2 className="font-mono text-16 font-medium leading-tight text-gray-12">{title}</h2>
      <div className="mt-1 text-11 text-gray-9">{sub}</div>
      {description && <p className="mt-2 text-12 leading-relaxed text-gray-11">{description}</p>}
    </div>
  );
}
