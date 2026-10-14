import { useCallback, useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';

// useDisclosure as "Writing a hook" sketches it, beside the plain view it
// drives: buttons and the regions they fold, with no component of bh's
// between them. The hook stays unexported here, as an example shows one
// component; in the package it is its own module.

interface UseDisclosureOptions {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  id?: string;
}

interface OwnTriggerProps {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

function useDisclosure({ open, defaultOpen = false, onOpenChange, id }: UseDisclosureOptions = {}) {
  const [held, setHeld] = useState(defaultOpen);
  const isOpen = open ?? held;
  const generated = useId();
  const regionId = id ?? generated;

  // What the actions read when they run, written after each commit: the
  // caller's latest onOpenChange is the one called, memoised or not.
  const live = useRef({ isOpen, owned: open !== undefined, onOpenChange });
  useLayoutEffect(() => {
    live.current = { isOpen, owned: open !== undefined, onOpenChange };
  });

  // One identity for the hook's life. An owned value is not copied: the
  // caller hears the change and passes the new `open` back.
  const setOpen = useCallback((next: boolean) => {
    const now = live.current;
    if (next === now.isOpen) {
      return;
    }
    now.isOpen = next;
    if (!now.owned) {
      setHeld(next);
    }
    now.onOpenChange?.(next);
  }, []);
  const openIt = useCallback(() => setOpen(true), [setOpen]);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const toggle = useCallback(() => setOpen(!live.current.isOpen), [setOpen]);

  // New when what they return changes. The caller's own click runs first.
  const getTriggerProps = useCallback(
    (props: OwnTriggerProps = {}) => {
      return {
        type: 'button' as const,
        'aria-expanded': isOpen,
        'aria-controls': isOpen ? regionId : undefined,
        onClick: (event: MouseEvent<HTMLButtonElement>) => {
          props.onClick?.(event);
          toggle();
        },
      };
    },
    [isOpen, regionId, toggle],
  );
  const getRegionProps = useCallback(() => {
    return { id: regionId, hidden: !isOpen };
  }, [isOpen, regionId]);

  return { isOpen, open: openIt, close, toggle, setOpen, getTriggerProps, getRegionProps };
}

const TRIGGER = 'rounded-8 border-gray-6 border-1 px-12 py-6';

export function TwoPlainFolds() {
  // The hook holds this one.
  const shipping = useDisclosure();
  // The page holds this one, and the hook asks it for every change.
  const [returnsOpen, setReturnsOpen] = useState(true);
  const returns = useDisclosure({ open: returnsOpen, onOpenChange: setReturnsOpen });

  return (
    <div className="flex flex-col items-start gap-8">
      <button className={TRIGGER} {...shipping.getTriggerProps()}>
        {shipping.isOpen ? 'Hide' : 'Show'} shipping
      </button>
      <p className="text-13/19 text-gray-11" {...shipping.getRegionProps()}>
        Ships in two days, in one box.
      </p>
      <button className={TRIGGER} {...returns.getTriggerProps()}>
        {returns.isOpen ? 'Hide' : 'Show'} returns
      </button>
      <p className="text-13/19 text-gray-11" {...returns.getRegionProps()}>
        Free for thirty days.
      </p>
      <button
        className={TRIGGER}
        onClick={() => {
          shipping.close();
          setReturnsOpen(false);
        }}
      >
        Fold both
      </button>
    </div>
  );
}
