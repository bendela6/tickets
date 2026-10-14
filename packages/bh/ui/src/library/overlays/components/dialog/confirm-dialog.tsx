import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Button } from '../../../primitives/components/button';
import { Icon } from '../../../primitives/components/icon';
import { Input } from '../../../inputs/components/input';
import { DialogContent, DialogDescription, DialogRoot, DialogTitle } from './dialog';
import { isThenable } from './is-thenable';

export interface ConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /**
   * Called with `false` when it closes: by the cancel button, Esc or a click
   * on the dim, and when `onConfirm` is done. Never while `onConfirm` runs.
   */
  onOpenChange: (open: boolean) => void;
  /** The question, as the dialog's title. */
  title: ReactNode;
  /** A sentence under the title, as the dialog's description. */
  body?: ReactNode;
  /**
   * A body of your own, under `body` and above the buttons: a choice that
   * changes what the confirm does, a list of what it touches.
   */
  children?: ReactNode;
  /** The confirm button's label. */
  confirmLabel?: string;
  /** The cancel button's label. */
  cancelLabel?: string;
  /** Paints the confirm button in the `danger` tone instead of `primary`. */
  destructive?: boolean;
  /**
   * A phrase to type before confirming, for what can't be undone: a field
   * asks for it, and the confirm button stays disabled until the field
   * holds exactly this, case and spaces included.
   */
  phrase?: string;
  /** The phrase field's label: by default "Type `phrase` to confirm". */
  phraseLabel?: ReactNode;
  /**
   * Called when the confirm button is pressed. Return a promise and the
   * dialog waits, busy, and closes when it resolves; return anything else and
   * it closes at once. If the promise rejects, or this throws, the dialog
   * shows the error and stays open, to try again or cancel.
   *
   * It returns `unknown` rather than `void | Promise<void>` so that what was
   * passed before, which may return anything, still type-checks, and a
   * mutation's promise of its data can be handed over as it is.
   */
  onConfirm: () => unknown;
  /** What the dialog says when `onConfirm` fails: by default the error's own message. */
  describeError?: (error: unknown) => ReactNode;
}

/** What a failure says when nothing else is given: its message, or a sentence of its own. */
function messageOf(error: unknown): string {
  if (error instanceof Error && error.message !== '') {
    return error.message;
  }
  return typeof error === 'string' && error !== '' ? error : 'This could not be done.';
}

/**
 * A question in a dialog: a title, an optional body, a cancel button and a
 * confirm button. It waits for an `onConfirm` that returns a promise, and
 * shows its error if it fails.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  ...rest
}: ConfirmDialogProps) {
  // Whether `onConfirm` is running. The dialog holds open till it is done:
  // the work can't be called back, and closing would hide whether it
  // happened. Kept here, beside the root that would close it; the body,
  // which runs it, says when it starts and stops.
  const [running, setRunning] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  // `open` opens it, so there is no DialogTrigger. DialogContent gives focus
  // back to whatever had it as it opened, or near there if the confirm
  // deleted it, as it does a row.
  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (next || !running) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent ref={content}>
        <ConfirmBody
          {...rest}
          onOpenChange={onOpenChange}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          content={content}
          running={running}
          setRunning={setRunning}
        />
      </DialogContent>
    </DialogRoot>
  );
}

/**
 * The dialog's inside. DialogContent mounts it as the dialog opens and drops
 * it as it closes, so each opening starts with no error.
 */
function ConfirmBody({
  onOpenChange,
  title,
  body,
  children,
  confirmLabel,
  cancelLabel,
  destructive,
  phrase,
  phraseLabel,
  onConfirm,
  describeError = messageOf,
  content,
  running,
  setRunning,
}: Omit<ConfirmDialogProps, 'open'> & {
  content: RefObject<HTMLDivElement | null>;
  running: boolean;
  setRunning: (running: boolean) => void;
}) {
  // A failure, boxed, since a promise may reject with `undefined`.
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  // What is typed in the phrase field. Each opening starts with nothing, so
  // a phrase typed for one thing never arms the dialog for the next.
  const [typed, setTyped] = useState('');
  const phraseId = useId();
  const asksPhrase = phrase !== undefined && phrase !== '';
  const armed = !asksPhrase || typed === phrase;
  // Whether this opening is still on the page. A run outlives it when the
  // app closes the dialog itself, and what it settles to is then no one's.
  const alive = useRef(false);
  // Where focus was as the run began, to go back to if it fails.
  const refocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      setRunning(false);
    };
  }, [setRunning]);

  // The run disables the button it was started from, and a disabled button
  // drops focus to <body>, outside the dialog. So the dialog itself holds
  // focus while it runs, and a failure gives it back, once the buttons take
  // it again.
  useLayoutEffect(() => {
    const element = refocus.current;
    if (running || !element) {
      return;
    }
    refocus.current = null;
    const active = document.activeElement;
    if (active === null || active === document.body || active === content.current) {
      element.focus();
    }
  }, [running, content]);

  function confirm() {
    if (running || !armed) {
      return;
    }
    setFailure(null);
    let result: unknown;
    try {
      result = onConfirm();
    } catch (error) {
      setFailure({ error });
      return;
    }
    if (!isThenable(result)) {
      onOpenChange(false);
      return;
    }
    const active = document.activeElement;
    refocus.current =
      active instanceof HTMLElement &&
      active !== content.current &&
      content.current?.contains(active)
        ? active
        : null;
    content.current?.focus();
    setRunning(true);
    Promise.resolve(result).then(
      () => {
        if (alive.current) {
          refocus.current = null;
          setRunning(false);
          onOpenChange(false);
        }
      },
      (error: unknown) => {
        if (alive.current) {
          setRunning(false);
          setFailure({ error });
        }
      },
    );
  }

  return (
    <>
      <DialogTitle>{title}</DialogTitle>
      {body ? <DialogDescription>{body}</DialogDescription> : null}
      {children ? <div className="mt-16 min-w-0">{children}</div> : null}
      {asksPhrase ? (
        <div className="mt-16 flex flex-col gap-6">
          <label htmlFor={phraseId} className="text-13/19 text-gray-11 font-sans">
            {phraseLabel ?? (
              <>
                Type <span className="text-gray-12 font-mono">{phrase}</span> to confirm
              </>
            )}
          </label>
          {/* It takes focus as the dialog opens: typing it is what the dialog asks. */}
          <Input
            id={phraseId}
            value={typed}
            onChange={setTyped}
            disabled={running}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing && armed) {
                event.preventDefault();
                confirm();
              }
            }}
          />
        </div>
      ) : null}
      {failure ? (
        <div
          role="alert"
          className="rounded-8 bg-red-3 text-red-11 text-12/17 mt-16 flex items-start gap-8 px-12 py-8 font-sans"
        >
          <Icon name="triangle-alert" size="sm" className="mt-2 shrink-0" />
          <div className="min-w-0 break-words">{describeError(failure.error)}</div>
        </div>
      ) : null}
      <div className="mt-16 flex justify-end gap-8">
        <Button variant="outline" disabled={running} onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button
          variant="solid"
          tone={destructive ? 'danger' : 'primary'}
          disabled={!armed}
          loading={running}
          onClick={confirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </>
  );
}
