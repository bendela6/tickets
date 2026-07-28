import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Popover as RadixPopover } from 'radix-ui';
import { cn } from '../../style/cn';

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;
export const PopoverClose = RadixPopover.Close;

type PopoverContentProps = ComponentPropsWithoutRef<typeof RadixPopover.Content>;

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
            'z-50 rounded-lg border border-gray-6 bg-surface-raised text-gray-12 shadow-lg',
            'font-sans text-13/19 outline-none',
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
