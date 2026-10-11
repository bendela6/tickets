import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { DropdownMenu } from 'radix-ui';
import { cn } from '../../../../style/cn';

/** A menu's root: it holds whether the menu is open. Radix's `DropdownMenu.Root`. */
export const Menu = DropdownMenu.Root;
/** The button that opens the menu; with `asChild`, the element it wraps. */
export const MenuTrigger = DropdownMenu.Trigger;

type MenuContentProps = ComponentPropsWithoutRef<typeof DropdownMenu.Content>;

/** The menu's list of items, in a portal: 6 pixels from its trigger, aligned to its start. */
export const MenuContent = forwardRef<HTMLDivElement, MenuContentProps>(function MenuContent(
  { className, sideOffset = 6, align = 'start', children, ...rest },
  ref,
) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'rounded-8 border-gray-6 bg-surface-raised text-gray-12 z-50 min-w-190 border-1 p-4 shadow-lg',
          'text-13/19 font-sans outline-none',
          className,
        )}
        {...rest}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
});

type MenuItemProps = ComponentPropsWithoutRef<typeof DropdownMenu.Item> & {
  /** A key shown at the item's end. It is only shown: the app binds the key itself. */
  shortcut?: ReactNode;
  /** Paints the item red, for an action that destroys something. */
  destructive?: boolean;
};

/** One command in the menu; choosing it runs its `onSelect` and closes the menu. */
export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(function MenuItem(
  { className, shortcut, destructive, children, ...rest },
  ref,
) {
  return (
    <DropdownMenu.Item
      ref={ref}
      className={cn(
        'rounded-6 flex cursor-pointer items-center justify-between gap-24 px-8 py-6 outline-none select-none',
        'data-[highlighted]:bg-surface-inset data-disabled:pointer-events-none data-disabled:opacity-50',
        destructive ? 'text-red-9 data-[highlighted]:bg-red-3' : 'text-gray-12',
        className,
      )}
      {...rest}
    >
      <span>{children}</span>
      {shortcut ? <span className="text-12/17 text-gray-9 font-mono">{shortcut}</span> : null}
    </DropdownMenu.Item>
  );
});

/** A line between groups of items. */
export function MenuSeparator({
  className,
}: {
  /** Classes merged onto the line. */
  className?: string;
}) {
  return <DropdownMenu.Separator className={cn('bg-gray-6 mx-4 my-4 h-px', className)} />;
}
