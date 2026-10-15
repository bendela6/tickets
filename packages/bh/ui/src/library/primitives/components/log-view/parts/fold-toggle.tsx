import type { UseDisclosureResult } from '@bh/hooks';
import { cn, focusRing } from '../../../../../style';
import { Icon } from '../../icon';

interface FoldToggleProps {
  /** The fold's open state and its button's props, from `useDisclosure`. */
  fold: UseDisclosureResult;
  /** The id of the line's text, which names the button. */
  labelId: string;
  /** The ids of what describes the button: an entry's count, a section's state and time. */
  describedBy: string;
  /** The chevron's colour: an entry's first line's tone, or the quiet gray. */
  className?: string;
}

/**
 * The fold on a section's first line or a multi-line entry's: a chevron in
 * the gutter, turned while open.
 *
 * Its own small button rather than a row that is all button, so the line's
 * text stays text a reader selects and copies. `useDisclosure` gives it its
 * `aria-expanded`, its `aria-controls` (set only while open, when the lines
 * it names are there to point at) and its click; the browser, Enter and
 * Space.
 *
 * Named by the line's text and described by what it holds, so a screen
 * reader says the line, whether it is open, then how many lines it holds or
 * how the section went, as a Disclosure's title and summary do.
 */
export function FoldToggle({ fold, labelId, describedBy, className }: FoldToggleProps) {
  return (
    <button
      {...fold.getTriggerProps({
        'aria-labelledby': labelId,
        'aria-describedby': describedBy,
        className: cn(
          'rounded-4 hover:text-gray-12 flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center',
          // Inward: the gutter is narrow and the next line sits right under it,
          // where a halo would spill over.
          focusRing('indigo', 'focus-visible', 'inward'),
          className,
        ),
      })}
    >
      {/* Rotation rather than two glyphs, as Disclosure's chevron turns; it
          stops turning for a reader who asks for less motion. */}
      <span
        aria-hidden
        className={cn('inline-flex motion-safe:transition-transform', fold.isOpen && 'rotate-90')}
      >
        <Icon name="chevron-right" size="sm" />
      </span>
    </button>
  );
}
