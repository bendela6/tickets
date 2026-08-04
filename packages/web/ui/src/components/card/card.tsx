import type { HTMLAttributes } from 'react';
import { cn } from '../../style';
import type { Gap } from '../stack';

export type CardRadius = 'md' | 'lg' | 'xl';
/** Card padding reuses Stack's gap domain, so there is one spacing vocabulary
 *  in the package rather than two. */
export type Padding = Gap;

const RADIUS: Record<CardRadius, string> = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
};

export const PAD: Record<Padding, string> = {
  0: 'p-0',
  1: 'p-4',
  2: 'p-8',
  3: 'p-12',
  4: 'p-16',
  6: 'p-24',
  8: 'p-32',
};

type CardProps = HTMLAttributes<HTMLDivElement> & {
  radius?: CardRadius;
  padding?: Padding;
  /** Adds the hover border-lift and pointer cursor for a card that is a link
   *  or a button. Does not make it focusable — wrap it or use `role`. */
  interactive?: boolean;
};

/**
 * The raised surface every panel in the app rebuilds by hand today.
 *
 * `padding` defaults to 0 because a Card containing a CardHeader must have
 * none: the header's bottom rule has to reach both edges, which it cannot do
 * from inside the parent's padding box. A headerless card sets `padding`
 * itself. Setting `padding` AND using CardHeader is the one combination that
 * misrenders, and it is a documented rule rather than a runtime guard —
 * enforcing it would cost a context provider to save a sentence of docs.
 *
 * `overflow-hidden` is load-bearing: without it a CardHeader's rule and any
 * full-bleed child square off the rounded corners.
 */
export function Card({
  radius = 'xl',
  padding = 0,
  interactive,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden border-1 border-gray-6 bg-surface-raised',
        RADIUS[radius],
        PAD[padding],
        interactive && 'cursor-pointer hover:border-gray-7',
        className,
      )}
      {...rest}
    />
  );
}

/** Header band with the dividing rule. Carries its own padding — see Card. */
export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b-1 border-gray-6 px-16 py-12', className)} {...rest} />;
}

/** The header's heading. Always an h3, so a card inside a page section lands
 *  at a sensible depth. A caller needing a different level should render its
 *  own heading element inside CardHeader rather than reaching for CardTitle. */
export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-sans text-13/19 font-600 text-gray-12', className)} {...rest} />;
}

type CardBodyProps = HTMLAttributes<HTMLDivElement> & { padding?: Padding };

/** Content region below the header. Defaults to `padding={4}` because that is
 *  what the surfaces being replaced use most. */
export function CardBody({ padding = 4, className, ...rest }: CardBodyProps) {
  return <div className={cn(PAD[padding], className)} {...rest} />;
}
