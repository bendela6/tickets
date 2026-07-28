import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Toast as RadixToast } from 'radix-ui';
import { cn } from '../../style/cn';

type ToastInput = { title: ReactNode; action?: { label: string; onClick: () => void } };
type ToastEntry = ToastInput & { id: number };

type ToastContextValue = { toast: (input: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: (input) => {
        const id = nextId.current;
        nextId.current += 1;
        setEntries((current) => [...current, { ...input, id }]);
      },
    }),
    [],
  );

  function dismiss(id: number) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider duration={4000} swipeDirection="right">
        {children}
        {entries.map((entry) => (
          <RadixToast.Root
            key={entry.id}
            open
            onOpenChange={(open) => {
              if (!open) {
                dismiss(entry.id);
              }
            }}
            className={cn(
              'flex items-center justify-between gap-4 rounded-lg border border-gray-6 bg-surface-raised px-3.5 py-2.5 shadow-lg',
              'font-sans text-ui text-gray-12',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
            )}
          >
            <RadixToast.Title className="flex items-center gap-1.5">{entry.title}</RadixToast.Title>
            {entry.action ? (
              <RadixToast.Action
                altText={entry.action.label}
                onClick={entry.action.onClick}
                className="font-sans text-ui font-500 text-indigo-9 hover:underline"
              >
                {entry.action.label}
              </RadixToast.Action>
            ) : null}
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
