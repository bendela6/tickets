import * as v from 'valibot';
import { formatDateTime } from '../../format/date-time';
import { defineFormat } from '../../format/registry';
import { isMoment, plainPieces } from '../../format/write';

/** Whether Intl knows the zone. */
function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const datetimeOptions = v.optional(
  v.strictObject({
    /** The clock's zone: `UTC`, `Asia/Tbilisi`. Default the app's. */
    timeZone: v.optional(
      v.pipe(v.string(), v.check(isTimeZone, 'a time zone Intl knows: UTC, Asia/Tbilisi')),
    ),
  }),
  {},
);

export type DatetimeOptions = v.InferOutput<typeof datetimeOptions>;

/** A date and a clock: `Jul 13, 2026, 09:05`. */
export const datetimeFormat = defineFormat({
  name: 'datetime',
  kinds: ['datetime'],
  options: datetimeOptions,
  format: (value, { timeZone }, context) => {
    return isMoment(value)
      ? [
          {
            text: formatDateTime(value, {
              locale: context.locale,
              timeZone: timeZone ?? context.timeZone,
            }),
          },
        ]
      : plainPieces(value);
  },
});
