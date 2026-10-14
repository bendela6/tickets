import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ConfirmDialog, type ConfirmDialogProps } from './confirm-dialog';
import { isThenable } from './is-thenable';

/**
 * What `confirm` asks: ConfirmDialog's props, less the three the provider
 * holds. `onConfirm` is optional here, since the answer is often all a
 * caller needs.
 */
export interface ConfirmOptions extends Omit<
  ConfirmDialogProps,
  'open' | 'onOpenChange' | 'onConfirm'
> {
  /**
   * Run when the confirm button is pressed, as ConfirmDialog runs it: a
   * promise keeps the dialog open, busy, until it settles, and a failure
   * shows in the dialog. `confirm` answers `true` only once it has worked.
   */
  onConfirm?: () => unknown;
}

/** What `useConfirm` returns. */
export interface Confirm {
  /**
   * Opens a ConfirmDialog and answers `true` once it is confirmed, and its
   * `onConfirm` has worked, or `false` when it is cancelled: by the cancel
   * button, Esc or a click on the dim.
   */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Returns `confirm`, which asks a question in a ConfirmDialog and answers
 * whether it was confirmed: an ask to await, in place of `window.confirm()`.
 * Throws outside a `ConfirmProvider`.
 *
 * @returns `{ confirm }`, where `await confirm({ title, … })` is `true` or `false`.
 */
export function useConfirm(): Confirm {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

interface Ask {
  id: number;
  options: ConfirmOptions;
}

/**
 * Holds the dialog that `useConfirm` asks in, one question at a time: an ask
 * made while another is open waits for it to close.
 */
export function ConfirmProvider({
  children,
}: {
  /** The part of the app that can ask: usually all of it. */
  children: ReactNode;
}) {
  // The asks in line; the first is the one shown.
  const [asks, setAsks] = useState<readonly Ask[]>([]);
  // The first ask once its dialog has closed. It stays first, and its
  // dialog closed, while focus goes back to what opened it.
  const [closed, setClosed] = useState<number | null>(null);
  const answers = useRef(new Map<number, (confirmed: boolean) => void>());
  const confirmed = useRef(new Set<number>());
  const nextId = useRef(1);

  const value = useMemo<Confirm>(() => {
    return {
      confirm: (options) => {
        return new Promise<boolean>((resolve) => {
          const id = nextId.current;
          nextId.current += 1;
          answers.current.set(id, resolve);
          setAsks((current) => [...current, { id, options }]);
        });
      },
    };
  }, []);

  // An ask still open as the provider leaves the page is answered no.
  useEffect(() => {
    const pending = answers.current;
    return () => {
      for (const answer of pending.values()) {
        answer(false);
      }
      pending.clear();
    };
  }, []);

  const ask = asks[0];
  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {ask ? (
        <ConfirmDialog
          {...ask.options}
          open={ask.id !== closed}
          onOpenChange={(open) => {
            if (open || ask.id === closed) {
              return;
            }
            const answer = answers.current.get(ask.id);
            answers.current.delete(ask.id);
            answer?.(confirmed.current.delete(ask.id));
            setClosed(ask.id);
            // The next ask waits until this dialog has given focus back to
            // what opened it, so that it opens from there and gives focus
            // back there too. Radix does that a task after the dialog
            // leaves the page, which is after this one; so two.
            setTimeout(() => {
              setTimeout(() => {
                setAsks((current) => current.slice(1));
                setClosed(null);
              });
            });
          }}
          onConfirm={() => {
            const result = ask.options.onConfirm?.();
            // Confirmed only once it has worked: a failure leaves the dialog
            // open, to try again or cancel, and a cancel then answers no.
            if (isThenable(result)) {
              return Promise.resolve(result).then(() => {
                confirmed.current.add(ask.id);
              });
            }
            confirmed.current.add(ask.id);
            return result;
          }}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}
