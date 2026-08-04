import type { ReactNode } from 'react';

import { Dot, Pill } from '@tickets/ui';
import { BADGE_TONE, type BadgeTone } from './badge-tone';

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
  tone: BadgeTone;
  badge: string;
  title: string;
  titleColor?: string;
  sub: ReactNode;
  description?: string | null;
}) {
  return (
    <div className="sticky top-0 z-10 border-b-1 border-gray-6 bg-gray-2 px-16 pb-12 pt-16">
      <div className="mb-8 flex items-center gap-8">
        <Pill
          variant="tint"
          size="xs"
          tone={BADGE_TONE[tone]}
          label={badge}
          className="font-mono uppercase font-600"
        />
        {titleColor && <Dot color={titleColor} />}
      </div>
      <h2 className="font-mono text-16 font-500 leading-tight text-gray-12">{title}</h2>
      <div className="mt-4 text-11 text-gray-11">{sub}</div>
      {description && <p className="mt-8 text-12 leading-relaxed text-gray-11">{description}</p>}
    </div>
  );
}
