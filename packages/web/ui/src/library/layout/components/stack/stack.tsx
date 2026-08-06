import type { HTMLAttributes } from 'react';
import { cn } from '../../../../style';

/** Tailwind spacing units, enumerated. Deliberately NOT a named xs/sm/md scale:
 *  docs/design/foundation-tokens.md records spacing as non-tokenized because
 *  Tailwind's numbered 4px scale already is one, and a second vocabulary would
 *  give the codebase two ways to say 16px. */
export type Gap = 0 | 1 | 2 | 3 | 4 | 6 | 8;
export type Align = 'start' | 'center' | 'end' | 'stretch';

export const GAP: Record<Gap, string> = {
  0: 'gap-0',
  1: 'gap-4',
  2: 'gap-8',
  3: 'gap-12',
  4: 'gap-16',
  6: 'gap-24',
  8: 'gap-32',
};

export const ALIGN: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: Gap;
  align?: Align;
};

/** Vertical flex container. Structure only — it takes no `tone` and paints
 *  no surface; wrap it in a Card if you need one. */
export function Stack({ gap = 4, align, className, ...rest }: StackProps) {
  return (
    <div className={cn('flex flex-col', GAP[gap], align && ALIGN[align], className)} {...rest} />
  );
}
