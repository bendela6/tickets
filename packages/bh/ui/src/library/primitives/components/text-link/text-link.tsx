import {
  cloneElement,
  forwardRef,
  isValidElement,
  type AnchorHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Slot } from 'radix-ui';
import { cn, focusRing } from '../../../../style';

// The look, said once: the text's own colour at its strongest rung, and an
// underline only under the pointer, so a link in a line of gray reads as the
// one thing in it to follow without shouting.
//
// The ring is the inward one. A link sits in running text, where a halo would
// spill over the lines above and below it, and the halo alone (a link has no
// border for the outward rim to colour) is far under the 3:1 a focus mark
// needs. The inset rim is the same 2px at rung 11 every control's rim is.
//
// `disabled:` only ever matches a `<button>`: a link has no disabled state,
// and one that leads nowhere yet should not be a link.
const TEXT_LINK = cn(
  'text-gray-12 cursor-pointer rounded-2 underline-offset-2 hover:underline',
  'disabled:text-gray-9 disabled:cursor-default disabled:no-underline',
  focusRing('indigo', 'focus-visible', 'inward'),
);

type TextLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /**
   * Styles the one element it wraps instead of drawing an `<a>`: a router's
   * link, or a `<button>` that reads as a link.
   *
   * @bh/ui knows no router, so a router's link comes in as the child, and
   * takes the look and the other props from here. Radix's `asChild`, as the
   * library's triggers take it.
   */
  asChild?: boolean;
  /** Added to its classes, where a colour or a size wins over its own. */
  className?: string;
  /** The link's text; with `asChild`, the one element it styles. */
  children?: ReactNode;
};

/** A link in a line of text: its strongest gray, underlined under the pointer. */
export const TextLink = forwardRef<HTMLAnchorElement, TextLinkProps>(function TextLink(
  { asChild = false, className, children, ...rest },
  ref,
) {
  if (asChild && isValidElement<{ className?: string }>(children)) {
    // Slot joins the two classNames as they are, so a child's `text-red-11`
    // would sit beside `text-gray-12` and the stylesheet's order would pick.
    // Merging them here first lets the child's win, as a caller's does.
    const child = children as ReactElement<{ className?: string }>;
    return (
      <Slot.Root ref={ref} className={cn(TEXT_LINK, className, child.props.className)} {...rest}>
        {cloneElement(child, { className: undefined })}
      </Slot.Root>
    );
  }
  return (
    <a ref={ref} className={cn(TEXT_LINK, className)} {...rest}>
      {children}
    </a>
  );
});
