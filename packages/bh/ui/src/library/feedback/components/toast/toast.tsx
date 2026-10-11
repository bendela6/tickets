import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Toast as RadixToast } from 'radix-ui';
import { cn } from '../../../../style/cn';

interface ToastInput {
  /** The message. */
  title: ReactNode;
  /** A button beside the message: its label, and what it does. */
  action?: { label: string; onClick: () => void };
}
type ToastEntry = ToastInput & { id: number };

interface ToastContextValue {
  /** Shows a toast with a title and, optionally, one action. */
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Returns `toast`, which shows a toast. Throws outside a `ToastProvider`.
 *
 * @returns `toast({ title, action })`: `title` is the message, and `action`, if
 * given, a button beside it as `{ label, onClick }`.
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/** Holds the toasts that `useToast` shows, and draws them in the bottom-right corner. */
export function ToastProvider({
  children,
}: {
  /** The part of the app that can show a toast: usually all of it. */
  children: ReactNode;
}) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const value = useMemo<ToastContextValue>(() => {
    return {
      toast: (input) => {
        const id = nextId.current;
        nextId.current += 1;
        setEntries((current) => [...current, { ...input, id }]);
      },
    };
  }, []);

  function dismiss(id: number) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider duration={4000} swipeDirection="right">
        {children}
        {entries.map((entry) => {
          return (
            <RadixToast.Root
              key={entry.id}
              open
              onOpenChange={(open) => {
                if (!open) {
                  dismiss(entry.id);
                }
              }}
              className={cn(
                'rounded-8 border-gray-6 bg-surface-raised flex items-center justify-between gap-16 border-1 px-14 py-10 shadow-lg',
                'text-13/19 text-gray-12 font-sans',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
              )}
            >
              <RadixToast.Title className="flex items-center gap-6">{entry.title}</RadixToast.Title>
              {entry.action ? (
                <RadixToast.Action
                  altText={entry.action.label}
                  onClick={entry.action.onClick}
                  className="text-13/19 font-500 text-indigo-9 font-sans hover:underline"
                >
                  {entry.action.label}
                </RadixToast.Action>
              ) : null}
            </RadixToast.Root>
          );
        })}
        {/*
          A toast raised from inside a modal layer (Dialog, Drawer) has to stay
          usable, and two radix mechanisms conspire against that. The viewport
          is a `DismissableLayer.Branch`, so clicking it never dismisses the
          layer — but the branch does not re-grant pointer events, and the open
          layer has put `pointer-events: none` on <body>. Inline rather than a
          utility class because it must win over that inherited `none`, and
          only while there is something to click: an empty viewport that
          claimed pointer events would swallow clicks in its corner.

          `aria-live` is the second half. The modal layer calls `hideOthers`,
          which `aria-hidden`s every <body> subtree except the portal — the
          viewport lives in the app tree, so it goes dark for assistive tech.
          `hideOthers` deliberately spares live regions, and a toast viewport
          is one. `off`, not `polite`: radix already announces each toast
          through its own portalled `role="status"` node, and a second live
          region over the same text would double it up.
        */}
        <RadixToast.Viewport
          aria-live="off"
          style={{ pointerEvents: entries.length > 0 ? 'auto' : undefined }}
          className="fixed right-16 bottom-16 z-50 flex w-320 max-w-[calc(100vw-2rem)] flex-col gap-8 outline-none"
        />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
