import * as v from 'valibot';
import { partsOf } from '../../format/duration';
import { measuresAsPieces } from '../../format/pieces';
import { defineFormat } from '../../format/registry';
import { isNumber, plainPieces } from '../../format/write';

const durationOptions = v.optional(
  v.strictObject({
    /** The number's unit: `ms`, `s`, `min` or `h`. Default `min`. */
    unit: v.optional(v.picklist(['ms', 's', 'min', 'h'])),
    /** Days past a day: `3d 4h`. Default off. */
    days: v.optional(v.boolean()),
  }),
  {},
);

export type DurationOptions = v.InferOutput<typeof durationOptions>;

/** A length of time: `2h 5m`, `840ms`. */
export const durationFormat = defineFormat({
  name: 'duration',
  kinds: ['number'],
  options: durationOptions,
  format: (value, options) => {
    const parts = isNumber(value) ? partsOf(value, options) : undefined;
    return parts === undefined ? plainPieces(value) : measuresAsPieces(parts);
  },
});
