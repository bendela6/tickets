import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { DropdownMenu } from 'radix-ui';
import { cn } from '../../../../style/cn';
import { Icon } from '../../../primitives/components/icon';

// What a menu and a submenu share, so the two lists, and an item and the row
// that opens a submenu, can't drift apart.
const SURFACE = [
  'rounded-8 border-gray-6 bg-surface-raised text-gray-12 z-50 min-w-190 border-1 p-4 shadow-lg',
  'text-13/19 font-sans outline-none',
];
const ROW = [
  'rounded-6 flex cursor-pointer items-center justify-between gap-24 px-8 py-6 outline-none select-none',
  'data-[highlighted]:bg-surface-inset data-disabled:pointer-events-none data-disabled:opacity-50',
];

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
        className={cn(SURFACE, className)}
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
        ROW,
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

/** A row that opens a second menu beside it: a `MenuSubTrigger` and its `MenuSubContent`. Radix's `DropdownMenu.Sub`. */
export const MenuSub = DropdownMenu.Sub;

type MenuSubTriggerProps = ComponentPropsWithoutRef<typeof DropdownMenu.SubTrigger>;

/**
 * The row that opens a submenu: a `MenuItem` with a chevron at its end, lit
 * while its submenu is open. Hovering it, or → / Enter / Space on it, opens the
 * submenu; ← from the submenu closes it and comes back here.
 */
export const MenuSubTrigger = forwardRef<HTMLDivElement, MenuSubTriggerProps>(
  function MenuSubTrigger({ className, children, ...rest }, ref) {
    return (
      <DropdownMenu.SubTrigger
        ref={ref}
        className={cn(ROW, 'text-gray-12 data-[state=open]:bg-surface-inset', className)}
        {...rest}
      >
        <span>{children}</span>
        <Icon name="chevron-right" size="xs" className="text-gray-9" />
      </DropdownMenu.SubTrigger>
    );
  },
);

type MenuSubContentProps = ComponentPropsWithoutRef<typeof DropdownMenu.SubContent>;

/**
 * A submenu's list of items, in a portal: `MenuContent`'s surface, 4 pixels
 * from its trigger, its first item level with the trigger's row.
 */
export const MenuSubContent = forwardRef<HTMLDivElement, MenuSubContentProps>(
  function MenuSubContent({ className, sideOffset = 4, alignOffset = -5, children, ...rest }, ref) {
    return (
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          ref={ref}
          sideOffset={sideOffset}
          // Up by the surface's padding and border, 4 and 1, so the first
          // item sits level with the row that opened it.
          alignOffset={alignOffset}
          className={cn(SURFACE, className)}
          {...rest}
        >
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    );
  },
);

/** A line between groups of items. */
export function MenuSeparator({
  className,
}: {
  /** Classes merged onto the line. */
  className?: string;
}) {
  return <DropdownMenu.Separator className={cn('bg-gray-6 mx-4 my-4 h-px', className)} />;
}
