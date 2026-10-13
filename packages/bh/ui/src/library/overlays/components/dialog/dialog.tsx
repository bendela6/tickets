import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { Button } from '../../../primitives/components/button';
import { cn } from '../../../../style/cn';
import { useRestoreFocus } from '../../parts/restore-focus';

/** A dialog's root: it holds whether the dialog is open. Radix's `Dialog.Root`. */
export const DialogRoot = RadixDialog.Root;
/** The button that opens the dialog, and takes focus back when it closes. */
export const DialogTrigger = RadixDialog.Trigger;
/** A button that closes the dialog; with `asChild`, the element it wraps. */
export const DialogClose = RadixDialog.Close;

type DialogContentProps = ComponentPropsWithoutRef<typeof RadixDialog.Content>;

/** The dialog's window, centred over a dim that covers the page, in a portal. */
export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
  { className, children, onFocus, onCloseAutoFocus, ...rest },
  ref,
) {
  // Radix gives focus back only to a DialogTrigger, and a dialog is often
  // opened by `open` from a row or a menu instead. The hook gives it back to
  // whatever opened it, and leaves the trigger as Radix's own fallback.
  const restoreFocus = useRestoreFocus();
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" />
      <RadixDialog.Content
        ref={ref}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
          'rounded-12 border-gray-6 bg-surface-raised text-gray-12 border-1 p-20 shadow-lg outline-none',
          'font-sans',
          className,
        )}
        onFocus={(event) => {
          restoreFocus.onFocus(event);
          onFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          restoreFocus.onCloseAutoFocus(event);
        }}
        {...rest}
      >
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});

/** The dialog's title, which names it for assistive technology. */
export function DialogTitle({
  children,
  className,
}: {
  /** The title's text. */
  children: ReactNode;
  /** Classes merged onto the title. */
  className?: string;
}) {
  return (
    <RadixDialog.Title className={cn('text-16 font-600 text-gray-12 font-sans', className)}>
      {children}
    </RadixDialog.Title>
  );
}

/** A sentence under the title, which describes the dialog for assistive technology. */
export function DialogDescription({
  children,
  className,
}: {
  /** The description's text. */
  children: ReactNode;
  /** Classes merged onto the description. */
  className?: string;
}) {
  return (
    <RadixDialog.Description className={cn('text-13/19 text-gray-11 mt-6 font-sans', className)}>
      {children}
    </RadixDialog.Description>
  );
}

interface ConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called with `false` when it closes: by either button, Esc or a click on the dim. */
  onOpenChange: (open: boolean) => void;
  /** The question, as the dialog's title. */
  title: ReactNode;
  /** A sentence under the title, as the dialog's description. */
  body?: ReactNode;
  /** The confirm button's label. */
  confirmLabel?: string;
  /** The cancel button's label. */
  cancelLabel?: string;
  /** Paints the confirm button in the `danger` tone instead of `primary`. */
  destructive?: boolean;
  /** Called when the confirm button is pressed, before the dialog closes. */
  onConfirm: () => void;
}

/** A question in a dialog: a title, an optional body, a cancel button and a confirm button. */
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
  // `open` opens it, so there is no DialogTrigger. DialogContent gives focus
  // back to whatever had it as it opened, or near there if the confirm
  // deleted it, as it does a row.
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
