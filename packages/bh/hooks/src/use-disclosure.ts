import {
  useCallback,
  useId,
  type ComponentProps,
  type HTMLAttributes,
  type MouseEvent,
} from 'react';
import { mergeProps } from './merge-props';
import { useControllableState } from './use-controllable-state';

/** What `useDisclosure` takes. Every option is optional: `useDisclosure()`. */
export interface UseDisclosureOptions {
  /** Whether it is open, for a caller that holds it; it then changes only through `onOpenChange`. */
  open?: boolean;
  /** Whether it starts open, while the hook holds it. Read on the first render only. */
  defaultOpen?: boolean;
  /** Hears every change, with the new value, whoever holds it. */
  onOpenChange?: (open: boolean) => void;
  /** The region's id, for an app that needs a fixed one; `useId()` gives one otherwise. */
  id?: string;
}

/** What `getTriggerProps` sets on the `<button>`, over the caller's own props. */
export interface DisclosureTriggerProps {
  type: 'button';
  'aria-expanded': boolean;
  /** The region's id while it is open; nothing while folded, when the region may not be there. */
  'aria-controls': string | undefined;
  /** Folds or opens it, after the caller's own click. */
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

/** What `getRegionProps` sets on the region, over the caller's own props. */
export interface DisclosureRegionProps {
  id: string;
  hidden: boolean;
}

/** What `useDisclosure` gives back: state, actions, then prop getters. */
export interface UseDisclosureResult {
  /** Whether the region is open. */
  isOpen: boolean;
  /** Opens it. The same function for the hook's life, as every action is. */
  open: () => void;
  /** Folds it. */
  close: () => void;
  /** Opens it if folded, folds it if open. */
  toggle: () => void;
  /** Opens or folds it. */
  setOpen: (open: boolean) => void;
  /**
   * The trigger, a `<button>`: its `type`, `aria-expanded`, `aria-controls`
   * while open, and its click, with yours merged in. A row or a heading that
   * folds puts a button inside it, and spreads this on the button.
   */
  getTriggerProps: (
    own?: ComponentProps<'button'>,
  ) => ComponentProps<'button'> & DisclosureTriggerProps;
  /** The region: its `id`, and `hidden` while folded, with yours merged in. */
  getRegionProps: <Own extends HTMLAttributes<HTMLElement>>(
    own?: Own,
  ) => Omit<Own, keyof DisclosureRegionProps> & DisclosureRegionProps;
}

/**
 * An open-or-folded state, with the props for the button that folds and the
 * region it folds, and no markup of its own. The browser makes the button
 * work with Enter and Space and gives it a place in the tab order.
 *
 * Its server value is folded, or `defaultOpen`, or `open`.
 */
export function useDisclosure({
  open,
  defaultOpen = false,
  onOpenChange,
  id,
}: UseDisclosureOptions = {}): UseDisclosureResult {
  const [isOpen, setValue] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const generated = useId();
  const regionId = id ?? generated;

  const setOpen = useCallback((next: boolean) => setValue(next), [setValue]);
  const openIt = useCallback(() => setValue(true), [setValue]);
  const close = useCallback(() => setValue(false), [setValue]);
  const toggle = useCallback(() => setValue((now) => !now), [setValue]);

  // New when what they return changes. The caller's own click runs first.
  const getTriggerProps = useCallback(
    (own?: ComponentProps<'button'>) => {
      return mergeProps(own, {
        type: 'button' as const,
        'aria-expanded': isOpen,
        'aria-controls': isOpen ? regionId : undefined,
        onClick: (_event: MouseEvent<HTMLButtonElement>) => toggle(),
      });
    },
    [isOpen, regionId, toggle],
  );
  const getRegionProps = useCallback(
    <Own extends HTMLAttributes<HTMLElement>>(own?: Own) => {
      return mergeProps(own, { id: regionId, hidden: !isOpen });
    },
    [isOpen, regionId],
  );

  return { isOpen, open: openIt, close, toggle, setOpen, getTriggerProps, getRegionProps };
}
