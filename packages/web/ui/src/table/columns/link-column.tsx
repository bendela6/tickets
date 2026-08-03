import type { Renderer } from '@tickets/table';
import { cn, TONE_RAMP } from '../../style';

type LinkColumnOpts = { href: (row: unknown) => string; external?: boolean };

export function LinkColumn(opts: LinkColumnOpts): Renderer<string> {
  return ({ value, row }) => (
    <a
      href={opts.href(row)}
      // Rows are usually clickable too; without this, following a link would
      // also open the row's drawer behind it.
      onClick={(e) => e.stopPropagation()}
      {...(opts.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      // `primary` is a TONE, not a colour family — there is no `primary-11`
      // utility, so the role goes through TONE_RAMP (primary -> indigo) and 11
      // is the text rung.
      className={cn('truncate hover:underline', `text-${TONE_RAMP.primary}-11`)}
    >
      {value}
    </a>
  );
}
