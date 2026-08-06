import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { Button } from '../primitives/components/button';
import { cn } from '../../style/cn';

export const DialogRoot = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

type DialogContentProps = ComponentPropsWithoutRef<typeof RadixDialog.Content>;

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  { className, children, ...rest },
  ref,
) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" />
      <RadixDialog.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
          'rounded-xl border-1 border-gray-6 bg-surface-raised p-20 text-gray-12 shadow-lg outline-none',
          'font-sans',
          className,
        )}
        {...rest}
      >
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <RadixDialog.Title className={cn('font-sans text-16 font-600 text-gray-12', className)}>
      {children}
    </RadixDialog.Title>
  );
}

export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Description className={cn('mt-6 font-sans text-13/19 text-gray-11', className)}>
      {children}
    </RadixDialog.Description>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        {body ? <DialogDescription>{body}</DialogDescription> : null}
        <div className="mt-16 flex justify-end gap-8">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant="solid"
            tone={destructive ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
