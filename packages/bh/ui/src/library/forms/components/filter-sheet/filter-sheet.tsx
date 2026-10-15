import type { FilterSheetProps } from '@bh/form';
import { Drawer, DrawerControls } from '../../../overlays/components/drawer';
import { Button } from '../../../primitives/components/button';
import { Icon } from '../../../primitives/components/icon';
import { InlineRowContext } from '../../inline-row';
import { InlineFieldContext } from '../inline-field-wrapper/inline-field';

/**
 * A filter form's fields on a phone: a 44-pixel Filters button, with how many
 * conditions they hold on its badge, that opens a sheet from the bottom. The
 * sheet's own form scrolls inside it, its buttons kept at its foot. The
 * registry's `filter.sheet`.
 */
export function FilterSheet({ title, count, open, onOpenChange, children }: FilterSheetProps) {
  return (
    <>
      <Button
        variant="outline"
        tone="neutral"
        size="lg"
        aria-haspopup="dialog"
        aria-expanded={open}
        // The badge is a digit on screen; said, it is a phrase.
        aria-label={count > 0 ? `${title}, ${count} ${count === 1 ? 'filter' : 'filters'}` : title}
        onClick={() => onOpenChange(true)}
        className="shrink-0"
      >
        <Icon name="filter" size="md" />
        {title}
        {count > 0 ? (
          <span className="rounded-9 bg-indigo-9 text-12 px-7 font-mono leading-18 text-white">
            {count}
          </span>
        ) : null}
      </Button>
      {/* Portaled, as a drawer is: the sheet's form isn't nested in the bar's. */}
      <Drawer open={open} onOpenChange={onOpenChange} side="bottom" label={title}>
        <div className="flex shrink-0 justify-center pt-8 pb-2">
          <span aria-hidden className="rounded-2 bg-gray-7 h-4 w-36" />
        </div>
        <div className="flex shrink-0 items-center gap-8 px-16 pt-8 pb-12">
          {/* The drawer's own title names it; this one is for the eye. */}
          <span aria-hidden className="text-16 font-600 text-gray-12 flex-1">
            {title}
          </span>
          <DrawerControls />
        </div>
        <div className="filter-sheet min-h-0 flex-1 overflow-y-auto px-16">
          {/* Out of the bar's row: its fields are drawn full size, labels above. */}
          <InlineRowContext value={undefined}>
            <InlineFieldContext value={undefined}>{children}</InlineFieldContext>
          </InlineRowContext>
        </div>
      </Drawer>
    </>
  );
}
