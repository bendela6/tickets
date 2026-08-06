import type { HTMLAttributes } from 'react';
import { cn } from '../../style';
import { ALIGN, GAP, type Align, type Gap } from '../stack';

/** Row adds `baseline` to Stack's alignment domain: a label sitting next to a
 *  number wants their text baselines to line up, which a column never needs. */
export type RowAlign = Align | 'baseline';
export type Justify = 'start' | 'center' | 'end' | 'between';

const ROW_ALIGN: Record<RowAlign, string> = { ...ALIGN, baseline: 'items-baseline' };

const JUSTIFY: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

type RowProps = HTMLAttributes<HTMLDivElement> & {
  gap?: Gap;
  align?: RowAlign;
  justify?: Justify;
};

/** Horizontal flex container. Unlike Stack it defaults to `align="center"` —
 *  a row of a label, a control and a button is centred in every call site the
 *  ported form layouts have. */
export function Row({ gap = 4, align = 'center', justify, className, ...rest }: RowProps) {
  return (
    <div
      className={cn(
        'flex flex-row',
        GAP[gap],
        ROW_ALIGN[align],
        justify && JUSTIFY[justify],
        className,
      )}
      {...rest}
    />
  );
}
