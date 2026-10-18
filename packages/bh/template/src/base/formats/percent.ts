import * as v from 'valibot';
import { noFormats } from '../../format/registry';
import { digits, writeNumber } from '../../format/write';

const percentOptions = v.optional(
  v.strictObject({
    /** Most digits after the point. Default 0. */
    digits: v.optional(digits),
  }),
  {},
);

export type PercentOptions = v.InferOutput<typeof percentOptions>;

/** A fraction as a percent: 0.427 as `43%`. */
export const percentFormat = noFormats.define({
  name: 'percent',
  kinds: ['number'],
  options: percentOptions,
  format: (value, { digits: most = 0 }, context) => {
    return writeNumber(value, context, { style: 'percent', maximumFractionDigits: most });
  },
});
