import type { ReactNode } from 'react';

import { Badge, type Tone } from './badge';
import { Dot } from './dot';

// Sticky panel header shared by every view.
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
    <div className="sticky top-0 z-10 border-b border-gray-600 bg-gray-900 px-4 pb-3 pt-4">
      <div className="mb-2 flex items-center gap-2">
        <Badge tone={tone}>{badge}</Badge>
        {titleColor && <Dot color={titleColor} />}
      </div>
      <h2 className="font-mono text-lg font-medium leading-tight text-gray-50">{title}</h2>
      <div className="mt-1 text-xs text-gray-400">{sub}</div>
      {description && <p className="mt-2 text-sm leading-relaxed text-gray-200">{description}</p>}
    </div>
  );
}
