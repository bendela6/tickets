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
    <div className="sticky top-0 z-10 border-b border-border bg-surface px-4 pb-3 pt-3.5">
      <div className="mb-1.5 flex items-center gap-2">
        <Badge tone={tone}>{badge}</Badge>
        {titleColor && <Dot color={titleColor} />}
      </div>
      <h2 className="font-mono text-[0.98rem] font-medium leading-tight text-ink">{title}</h2>
      <div className="mt-1 text-[0.7rem] text-dim">{sub}</div>
      {description && <p className="mt-2 text-[0.74rem] leading-relaxed text-muted">{description}</p>}
    </div>
  );
}
