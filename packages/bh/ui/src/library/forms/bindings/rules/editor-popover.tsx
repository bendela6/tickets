import type { ReactNode } from 'react';
import { cn, focusRing } from '../../../../style';
import { Popover, PopoverContent, PopoverTrigger } from '../../../overlays/components/popover';

/** The dashed "+ Filter" button's look, in the bar and at the panel's foot. */
export const addButtonClass = cn(
  'rounded-5 border-gray-7 text-12 text-gray-11 hover:border-gray-8 hover:text-gray-12 border-1.5 inline-flex h-28 items-center gap-5 border-dashed pr-10 pl-8 font-sans',
  focusRing('indigo', 'focus-visible'),
);

/** A rule's editor, in a popover from the chip or the button that opens it. */
export function EditorPopover({
  open,
  onOpenChange,
  label,
  trigger,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent aria-label={label} className="w-320 p-0">
        {children}
      </PopoverContent>
    </Popover>
  );
}
