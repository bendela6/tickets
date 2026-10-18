import * as v from 'valibot';
import { relativeLabel } from '../../format/dates';
import { defineFormat } from '../../format/registry';
import { isMoment, plainPieces } from '../../format/write';

const relativeOptions = v.optional(
  v.strictObject({
    /** `day` or `minute`. Default `day` for a date, `minute` for a moment. */
    smallestUnit: v.optional(v.picklist(['day', 'minute'])),
  }),
  {},
);

export type RelativeOptions = v.InferOutput<typeof relativeOptions>;

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Counted from now: `3 days ago`, `in 2 hours`. */
export const relativeFormat = defineFormat({
  name: 'relative',
  kinds: ['date', 'datetime'],
  options: relativeOptions,
  format: (value, { smallestUnit }, { locale, now = new Date() }) => {
    return isMoment(value)
      ? [
          {
            text: relativeLabel(value, now, {
              locale,
              smallestUnit: smallestUnit ?? (DAY_ONLY.test(value) ? 'day' : 'minute'),
            }),
          },
        ]
      : plainPieces(value);
  },
});
