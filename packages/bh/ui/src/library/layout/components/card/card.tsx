import {
  cloneElement,
  forwardRef,
  isValidElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Slot } from 'radix-ui';
import { cn, focusRing } from '../../../../style';
import type { Gap } from '../stack';

export type CardRadius = 'md' | 'lg' | 'xl';
/** Card padding reuses Stack's gap domain, so there is one spacing vocabulary
 *  in the package rather than two. */
export type Padding = Gap;

const RADIUS: Record<CardRadius, string> = {
  md: 'rounded-6',
  lg: 'rounded-8',
  xl: 'rounded-12',
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
  /** How round the corners are: 6, 8 or 12 pixels. */
  radius?: CardRadius;
  /** Space inside the edge, in steps of 4 pixels. Leave it 0 when the card has a CardHeader. */
  padding?: Padding;
  /**
   * Adds the hover border-lift and pointer cursor for a card that is a link
   * or a button. Does not make a `<div>` focusable: with `asChild`, the card
   * is the link or the button itself.
   */
  interactive?: boolean;
  /**
   * Draws the card on the one element it wraps instead of a `<div>`: a
   * `<button>`, or a router's link, which @bh/ui doesn't know. That element
   * takes the card's look, its focus ring and the other props. Radix's
   * `asChild`, as `TextLink` takes it.
   */
  asChild?: boolean;
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
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { radius = 'xl', padding = 0, interactive, asChild = false, className, children, ...rest },
  ref,
) {
  const look = cn(
    'border-gray-6 bg-surface-raised overflow-hidden border-1',
    RADIUS[radius],
    PAD[padding],
    interactive && 'hover:border-gray-7 cursor-pointer',
    // A card that is a link or a button is a tab stop, and shows it as the
    // controls do: its border lit as the rim, and the halo around it.
    (asChild || interactive) && focusRing('indigo'),
  );
  if (asChild && isValidElement<{ className?: string }>(children)) {
    // A link is inline and a button centres its text: a card is a block that
    // starts at its left edge, whichever it is drawn on. Slot joins the two
    // classNames as they are, so they are merged here first and the child's
    // own win, as a caller's do.
    const child = children as ReactElement<{ className?: string }>;
    return (
      <Slot.Root
        ref={ref}
        className={cn(look, 'block text-left', className, child.props.className)}
        {...rest}
      >
        {cloneElement(child, { className: undefined })}
      </Slot.Root>
    );
  }
  return (
    <div ref={ref} className={cn(look, className)} {...rest}>
      {children}
    </div>
  );
});

type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  /** The header's content: a CardTitle, as a rule. */
  children?: ReactNode;
  /**
   * At the right end of the title's line, in small grey type unless it sets
   * its own: a figure, a link, a range picker.
   */
  aside?: ReactNode;
};

/**
 * Header band with the dividing rule. Carries its own padding — see Card.
 *
 * With an `aside` the band becomes a row: the children (a CardTitle, as a
 * rule) on the left, the aside pushed to the right, both on the title's
 * baseline. Without one it stays a plain block, so a header that stacks a
 * title over a line of its own keeps doing so. The aside's box is a block,
 * not a flex row, because flex would drop the spaces between an aside's
 * words and the links among them.
 */
export function CardHeader({ aside, className, children, ...rest }: CardHeaderProps) {
  // `false` too, so `aside={ready && …}` draws no empty box while it waits.
  if (aside == null || aside === false) {
    return (
      <div className={cn('border-gray-6 border-b-1 px-16 py-12', className)} {...rest}>
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'border-gray-6 flex min-w-0 items-baseline gap-8 border-b-1 px-16 py-12',
        className,
      )}
      {...rest}
    >
      {children}
      <div className="text-11/15 text-gray-11 ml-auto min-w-0">{aside}</div>
    </div>
  );
}

/** The header's heading. Always an h3, so a card inside a page section lands
 *  at a sensible depth. A caller needing a different level should render its
 *  own heading element inside CardHeader rather than reaching for CardTitle. */
export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-13/19 font-600 text-gray-12 font-sans', className)} {...rest} />;
}

type CardBodyProps = HTMLAttributes<HTMLDivElement> & {
  /** Space around the content, in steps of 4 pixels. */
  padding?: Padding;
};

/** Content region below the header. Defaults to `padding={4}` because that is
 *  what the surfaces being replaced use most. */
export function CardBody({ padding = 4, className, ...rest }: CardBodyProps) {
  return <div className={cn(PAD[padding], className)} {...rest} />;
}
