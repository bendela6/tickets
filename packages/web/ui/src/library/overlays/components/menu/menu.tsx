import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { DropdownMenu } from 'radix-ui';
import { cn } from '../../../../style/cn';

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

type MenuContentProps = ComponentPropsWithoutRef<typeof DropdownMenu.Content>;

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
          'z-50 min-w-190 rounded-lg border-1 border-gray-6 bg-surface-raised p-4 text-gray-12 shadow-lg',
          'font-sans text-13/19 outline-none',
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
  shortcut?: ReactNode;
  destructive?: boolean;
};

export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(function MenuItem(
  { className, shortcut, destructive, children, ...rest },
  ref,
) {
  return (
    <DropdownMenu.Item
      ref={ref}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-24 rounded-md px-8 py-6 outline-none select-none',
        'data-[highlighted]:bg-surface-inset data-disabled:pointer-events-none data-disabled:opacity-50',
        destructive ? 'text-red-9 data-[highlighted]:bg-red-3' : 'text-gray-12',
        className,
      )}
      {...rest}
    >
      <span>{children}</span>
      {shortcut ? <span className="font-mono text-12/17 text-gray-9">{shortcut}</span> : null}
    </DropdownMenu.Item>
  );
});

export function MenuSeparator({ className }: { className?: string }) {
  return <DropdownMenu.Separator className={cn('mx-4 my-4 h-px bg-gray-6', className)} />;
}
