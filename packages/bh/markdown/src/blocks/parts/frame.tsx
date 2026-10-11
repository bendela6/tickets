import type { ReactNode } from 'react';
import { cn } from '@bh/ui';

// The parts every framed block is built from, in the code block's look, so a
// change to the frame reaches every block. Whole class strings, since Tailwind
// sees only whole names.

/** The box a block sits in: 6px corners, a 1px rule, and it clips its own corners. */
export function BlockFrame({
  className,
  children,
  ...data
}: {
  className?: string;
  children: ReactNode;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <div
      {...data}
      className={cn('rounded-6 border-gray-6 mt-16 overflow-hidden border-1 first:mt-0', className)}
    >
      {children}
    </div>
  );
}

/** A frame's header band: inset, ruled underneath, 36px like the code block's. */
export function BlockBar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'bg-surface-inset border-gray-6 flex min-h-36 items-center gap-8 border-b-1 px-12 py-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The name in a frame's bar. */
export function BlockTitle({ children }: { children: ReactNode }) {
  return <span className="text-13 font-600 text-gray-12 min-w-0 truncate">{children}</span>;
}

/** The small label that names what a thing is: a section, a kind, a column head. */
export const KICKER = 'text-11/16 font-500 text-gray-10 tracking-wider uppercase';

export function Kicker({
  as: Tag = 'p',
  className,
  children,
}: {
  as?: 'p' | 'h4' | 'span';
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cn(KICKER, className)}>{children}</Tag>;
}
