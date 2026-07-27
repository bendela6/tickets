import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { DropdownMenu } from 'radix-ui';
import { cn } from '@tickets/ui';

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
          'z-50 min-w-47.5 rounded-card border border-hairline bg-raised p-1 text-ink shadow-lg',
          'font-sans text-ui outline-none',
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
        'flex cursor-pointer items-center justify-between gap-6 rounded-ctrl px-2 py-1.5 outline-none select-none',
        'data-[highlighted]:bg-inset data-disabled:pointer-events-none data-disabled:opacity-50',
        destructive ? 'text-danger data-[highlighted]:bg-danger-subtle' : 'text-ink',
        className,
      )}
      {...rest}
    >
      <span>{children}</span>
      {shortcut ? <span className="font-mono text-meta text-ink-3">{shortcut}</span> : null}
    </DropdownMenu.Item>
  );
});

export function MenuSeparator({ className }: { className?: string }) {
  return <DropdownMenu.Separator className={cn('mx-1 my-1 h-px bg-hairline', className)} />;
}
