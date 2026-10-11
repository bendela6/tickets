import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Popover as RadixPopover } from 'radix-ui';
import { cn } from '../../../../style/cn';

/** A popover's root: it holds whether the popover is open. Radix's `Popover.Root`. */
export const Popover = RadixPopover.Root;
/** The button that opens and closes the popover; with `asChild`, the element it wraps. */
export const PopoverTrigger = RadixPopover.Trigger;
/** An element to place the popover against instead of the trigger. */
export const PopoverAnchor = RadixPopover.Anchor;
/** A button that closes the popover; with `asChild`, the element it wraps. */
export const PopoverClose = RadixPopover.Close;

type PopoverContentProps = ComponentPropsWithoutRef<typeof RadixPopover.Content>;

/** The floating panel, in a portal: 6 pixels below its trigger, aligned to its start. */
export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  function PopoverContent(
    { className, sideOffset = 6, collisionPadding = 8, align = 'start', children, ...rest },
    ref,
  ) {
    return (
      <RadixPopover.Portal>
        <RadixPopover.Content
          ref={ref}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          align={align}
          className={cn(
            'rounded-8 border-gray-6 bg-surface-raised text-gray-12 z-50 border-1 shadow-lg',
            'text-13/19 font-sans outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            className,
          )}
          {...rest}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    );
  },
);
