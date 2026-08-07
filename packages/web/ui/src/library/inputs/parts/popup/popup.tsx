import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../../../overlays/components/popover';
import { cn } from '../../../../style';

/**
 * The popup geometry, exported separately for the handful of callers that must
 * render their own container — a calendar grid needs its own padding, and a
 * swatch grid its own gap. Everything else should use `Popup` and never see it.
 *
 * From the design's contract line: "Popups sit 4px below the trigger, radius 6,
 * 5px padding". The offset is a Radix prop rather than a class, so it lives in
 * `POPUP_OFFSET` beside this rather than inside it.
 *
 * Every class here is a literal, so Tailwind's source scanner finds them and
 * none of this needs the safelist. That is deliberate: the shell carries no
 * tone, so it has nothing to interpolate.
 */
export const popupClass =
  'z-50 rounded-6 border-1 border-gray-6 bg-surface-raised p-5 shadow-lg';

/** 4px below the trigger — the design's number, kept next to the class it pairs with. */
export const POPUP_OFFSET = 4;

type PopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element the popup hangs off. Rendered as-is, keeping its own handlers. */
  trigger: ReactNode;
  children: ReactNode;
  /** Match the trigger's width — right for a select, wrong for an icon grid. */
  matchTriggerWidth?: boolean;
  className?: string;
};

/**
 * The shell every popup in the input layer wears: anchoring, offset, radius,
 * padding and elevation — and nothing whatsoever about what goes inside it.
 *
 * That boundary is the point, and it is the reason this is separate from
 * `OptionRow`. The colour and icon pickers are grids rather than lists, so a
 * single do-everything list component would have grown a `layout` prop and two
 * divergent code paths through one file. They take this and render their own
 * contents; the list-shaped controls take this plus rows. If this file ever
 * needs to know whether it holds a list, the boundary was drawn in the wrong
 * place.
 */
export function Popup({
  open,
  onOpenChange,
  trigger,
  children,
  matchTriggerWidth = false,
  className,
}: PopupProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={POPUP_OFFSET}
        className={cn(
          popupClass,
          matchTriggerWidth && 'w-[var(--radix-popover-trigger-width)]',
          className,
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
