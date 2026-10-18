import * as v from 'valibot';
import { defineFormat } from '../../format/registry';
import { digits, writeNumber } from '../../format/write';

const numberOptions = v.optional(
  v.strictObject({
    /** Most digits after the point. Default 3. */
    digits: v.optional(digits),
    /** `compact`: 12400 as `12.4K`. */
    notation: v.optional(v.literal('compact')),
  }),
  {},
);

export type NumberOptions = v.InferOutput<typeof numberOptions>;

/** 1234.5 as `1,234.5`; compact, 12400 as `12.4K`. */
export const numberFormat = defineFormat({
  name: 'number',
  kinds: ['number'],
  options: numberOptions,
  format: (value, { digits: most, notation }, context) => {
    return writeNumber(value, context, {
      ...(most === undefined ? {} : { maximumFractionDigits: most }),
      ...(notation === undefined ? {} : { notation }),
    });
  },
});
