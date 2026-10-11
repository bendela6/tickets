import type { Renderer } from '@bh/table';
import { cn, TONE_HUE } from '../../../style';

interface LinkColumnOpts {
  /** The address of a row's link, from its row. */
  href: (row: unknown) => string;
  /** Opens the link in a new tab, with `rel="noopener noreferrer"`. */
  external?: boolean;
}

/**
 * A cell that is a link: the value as its text, to the address `href` gives
 * for the row. An empty value draws nothing. The link is not a tab stop: Enter
 * on the focused cell steps into it.
 */
export function LinkColumn(opts: LinkColumnOpts): Renderer<string | null | undefined> {
  return ({ value, row }) => {
    // A link with no text has no name: a reader would hear only "link".
    if (value == null || value === '') {
      return null;
    }
    return (
      <a
        href={opts.href(row)}
        // Rows are usually clickable too; without this, following a link would
        // also open the row's drawer behind it.
        onClick={(e) => e.stopPropagation()}
        // The cell is the grid's tab stop, not this. Reached with Enter or F2
        // from the focused cell, which is what the engine's step-in exists for.
        // Left tabbable, every link in every row would be its own stop and
        // tabbing past a table would take one press per visible row.
        tabIndex={-1}
        {...(opts.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        // `primary` is a TONE, not a colour family — there is no `primary-11`
        // utility, so the role goes through TONE_HUE (primary -> indigo) and 11
        // is the text rung.
        className={cn('truncate hover:underline', `text-${TONE_HUE.primary}-11`)}
      >
        {value}
      </a>
    );
  };
}
