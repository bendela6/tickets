import { cn, focusRing } from '../../../../../style';
import { Icon } from '../../icon';

interface EntryToggleProps {
  open: boolean;
  onToggle: () => void;
  /** The id of the entry's lines under its first, drawn only while open. */
  bodyId: string;
  /** The id of the first line's text, which names the button. */
  labelId: string;
  /** The id of the count of lines it folds, which describes the button. */
  countId: string;
  /** The chevron's colour: the entry's first line's tone, or the quiet gray. */
  className?: string;
}

/**
 * The fold on a multi-line entry's first line: a chevron in the gutter,
 * turned while open.
 *
 * Its own small button rather than a row that is all button, so the line's
 * text stays text a reader selects and copies. It is the one place the fold
 * is drawn, for `Disclosure`'s headless hook (GW-2.2.4, over TK-31.2's
 * `useDisclosure`) to take over: the open state, `aria-expanded` and
 * `aria-controls` are what that hook hands out.
 *
 * Named by the line's text and described by its count, so a screen reader
 * says the line, whether it is open, then how many lines it holds, as a
 * Disclosure's title and summary do. `aria-controls` is set only while open,
 * when the lines it names are there to point at.
 */
export function EntryToggle({
  open,
  onToggle,
  bodyId,
  labelId,
  countId,
  className,
}: EntryToggleProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={open ? bodyId : undefined}
      aria-labelledby={labelId}
      aria-describedby={countId}
      onClick={onToggle}
      className={cn(
        'rounded-4 hover:text-gray-12 flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center',
        // Inward: the gutter is narrow and the next line sits right under it,
        // where a halo would spill over.
        focusRing('indigo', 'focus-visible', 'inward'),
        className,
      )}
    >
      {/* Rotation rather than two glyphs, as Disclosure's chevron turns; it
          stops turning for a reader who asks for less motion. */}
      <span
        aria-hidden
        className={cn('inline-flex motion-safe:transition-transform', open && 'rotate-90')}
      >
        <Icon name="chevron-right" size="sm" />
      </span>
    </button>
  );
}
