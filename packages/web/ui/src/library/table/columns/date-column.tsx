import type { Renderer } from '@tickets/table';
import { RelativeDate } from '../../relative-date';

type DateColumnOpts = { style?: 'relative' | 'absolute' };

/** Uses the app's RelativeDate rather than porting items-core's formatRelative —
 *  two relative-time formatters would disagree at the day/month boundaries.
 *
 *  RelativeDate takes a `value: string` (an ISO date string) and does NOT
 *  guard against an unparseable one itself — `new Date('not-a-date')` inside
 *  it yields `NaN` fields, which would render as "NaN days ago" rather than
 *  failing loudly. DateColumn validates before handing off, and always passes
 *  a string (`date.toISOString()`), never a `Date` instance. */
export function DateColumn(
  opts: DateColumnOpts = {},
): Renderer<string | Date | null | undefined> {
  const style = opts.style ?? 'relative';
  return ({ value }) => {
    if (value == null) return <span className="text-gray-9">—</span>;
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return <span className="text-gray-9">—</span>;
    if (style === 'absolute') {
      return (
        <span className="font-mono text-12/17 text-gray-11" title={date.toISOString()}>
          {date.toLocaleString()}
        </span>
      );
    }
    return <RelativeDate value={date.toISOString()} />;
  };
}
