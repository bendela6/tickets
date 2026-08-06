import { useState, type ReactElement, type ReactNode } from 'react';
import { variants } from '../../../../style';
import { Popover, PopoverContent, PopoverTrigger } from '../popover';

/**
 * How far the panel insets its content. `none` is the default because the
 * dominant body is a list that draws its own row padding (OptionList, Menu
 * rows) and must bleed to the panel's rounded edge; `sm`/`md` are for
 * arbitrary content that needs breathing room. Before this, every call site
 * spelled the inset itself — three wrote `p-0`, one wrote `p-12`, and three
 * wrote nothing and got 0 by accident.
 */
export type DropdownPadding = 'none' | 'sm' | 'md';

export type DropdownSide = 'top' | 'right' | 'bottom' | 'left';
export type DropdownAlign = 'start' | 'center' | 'end';

// The panel's chrome (radius, border, surface, shadow, z-index) already lives
// in PopoverContent, so the shell adds exactly one axis of its own.
const panelClass = variants({
  base: '',
  config: {
    padding: {
      default: 'none',
      options: {
        none: 'p-0',
        sm: 'p-8',
        md: 'p-12',
      },
    },
  },
});

type DropdownProps = {
  /**
   * The element that opens the panel — a Button, a Pill, an Avatar, anything.
   * Typed as an element rather than a ReactNode because it is cloned by
   * radix's `asChild`: a bare string has nothing to clone onto and would fail
   * at runtime, so the compiler rejects it instead.
   *
   * The element must forward its ref and spread unknown props — radix anchors
   * the panel off the trigger's ref and writes `aria-expanded`/`data-state`
   * onto it. A component that destructures a fixed prop list silently drops
   * all of that and appears to work until the panel mispositions.
   */
  trigger: ReactElement;
  /**
   * The panel body. As a function it receives `close`, so a body that
   * commits a value (picking an option, running a command) can dismiss the
   * panel without the caller lifting open state it otherwise does not need.
   */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Controlled open state. Pass alongside `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: DropdownSide;
  align?: DropdownAlign;
  padding?: DropdownPadding;
  /** Merged onto the panel, not the trigger — the trigger styles itself. */
  className?: string;
};

/**
 * The popover shell every dropdown-shaped control is built from: a trigger
 * slot, the open state, and the panel. It is deliberately content-agnostic —
 * it knows nothing about options, selection or commands, so Combobox,
 * MultiCombobox and a one-off panel all compose it rather than re-deriving it.
 *
 * Open state defaults to uncontrolled and escalates to controlled the moment
 * `open` is passed, so the common case carries no state in the caller.
 */
export function Dropdown({
  trigger,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  side,
  align,
  padding,
  className,
}: DropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : uncontrolledOpen;

  function setOpen(next: boolean) {
    // A controlled caller owns the value; writing the internal copy too would
    // leave the two to drift the moment the caller declines a change.
    if (!controlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  }

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side={side} align={align} className={panelClass({ padding, className })}>
        {typeof children === 'function' ? children(() => setOpen(false)) : children}
      </PopoverContent>
    </Popover>
  );
}
