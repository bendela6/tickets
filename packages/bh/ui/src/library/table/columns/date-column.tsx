import type { Renderer } from '@bh/table';
import { RelativeDate } from '../../primitives/components/relative-date';

interface DateColumnOpts {
  /** `relative` ("3 days ago", the default) or `absolute`, in the reader's locale. */
  style?: 'relative' | 'absolute';
}

/**
 * A cell of a date or an ISO date string, written as a time ago or in full,
 * with the exact moment on hover. A missing or unreadable date is a dash.
 */
// Uses the library's RelativeDate rather than a second formatter — two
// relative-time formatters would disagree at the day/month boundaries.
//
// RelativeDate takes a `value: string` (an ISO date string) and does NOT
// guard against an unparseable one itself — `new Date('not-a-date')` inside
// it yields `NaN` fields, which would render as "NaN days ago" rather than
// failing loudly. DateColumn validates before handing off, and always passes
// a string (`date.toISOString()`), never a `Date` instance.
export function DateColumn(opts: DateColumnOpts = {}): Renderer<string | Date | null | undefined> {
  const style = opts.style ?? 'relative';
  return ({ value }) => {
    if (value == null) {
      return <span className="text-gray-9">—</span>;
    }
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
      return <span className="text-gray-9">—</span>;
    }
    if (style === 'absolute') {
      return (
        <span className="text-12/17 text-gray-11 font-mono" title={date.toISOString()}>
          {date.toLocaleString()}
        </span>
      );
    }
    return <RelativeDate value={date.toISOString()} />;
  };
}
