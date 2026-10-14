import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
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
