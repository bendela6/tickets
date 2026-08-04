import type { ReactNode } from 'react';
import { cn } from '../../style/cn';
import { Icon, type IconName } from '../icon';
import { TONE_HUE, type Tone } from '../../style/tones';

// The shared shell for a screen's error/empty/not-found state: an optional
// tone-colored icon disc, a title, optional body copy, and an optional
// action (Retry button, link, etc). Retires six near-verbatim copies of the
// signals error+Retry block plus assorted list-empty states.
export function ScreenState({
  title,
  icon,
  tone = 'neutral',
  body,
  action,
  className,
}: {
  title: ReactNode;
  icon?: IconName;
  tone?: Tone;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', className)}>
      {icon ? (
        <span
          className={cn(
            'flex size-7.5 items-center justify-center rounded-full',
            // The subtle pair: 3 fills, 11 texts.
            `bg-${TONE_HUE[tone]}-3 text-${TONE_HUE[tone]}-11`,
          )}
        >
          <Icon name={icon} size="md" />
        </span>
      ) : null}
      <div className="text-13/19 font-600 text-gray-12">{title}</div>
      {/* != null (not truthiness) — a numeric 0 body/action is real content
      and must render, not get swallowed like an unset one. */}
      {body != null ? <div className="max-w-90 text-12/17 text-gray-11">{body}</div> : null}
      {action != null ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
