import * as v from 'valibot';
import { defineFormat } from '../../format/registry';
import { writeNumber } from '../../format/write';

const moneyOptions = v.strictObject({
  /** An ISO 4217 code: `EUR`, `USD`. Required. */
  currency: v.pipe(
    v.string(),
    v.regex(/^[A-Z]{3}$/, 'a currency is an ISO 4217 code, three capital letters: EUR'),
  ),
});

export type MoneyOptions = v.InferOutput<typeof moneyOptions>;

/** An amount in a currency: `€12.50`. */
export const moneyFormat = defineFormat({
  name: 'money',
  kinds: ['number'],
  options: moneyOptions,
  format: (value, { currency }, context) => {
    return writeNumber(value, context, { style: 'currency', currency });
  },
});
