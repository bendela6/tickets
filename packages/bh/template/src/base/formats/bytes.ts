import * as v from 'valibot';
import { sizeOf } from '../../format/bytes';
import { measuresAsPieces } from '../../format/pieces';
import { defineFormat } from '../../format/registry';
import { digits, isNumber, plainPieces } from '../../format/write';

const bytesOptions = v.optional(
  v.strictObject({
    /** `binary` (KiB, MiB) or `decimal` (kB, MB). Default `binary`. */
    units: v.optional(v.picklist(['binary', 'decimal'])),
    /** Most digits after the point. Default 1. */
    digits: v.optional(digits),
    /** A rate, per `s`, `min` or `h`: `12.4 MiB/s`. */
    per: v.optional(v.picklist(['s', 'min', 'h'])),
  }),
  {},
);

export type BytesOptions = v.InferOutput<typeof bytesOptions>;

/** A size: `12.4 MiB`. A rate: `12.4 MiB/s`. */
export const bytesFormat = defineFormat({
  name: 'bytes',
  kinds: ['number'],
  options: bytesOptions,
  format: (value, { per, ...size }) => {
    const measure = isNumber(value) ? sizeOf(value, size) : undefined;
    return measure === undefined
      ? plainPieces(value)
      : measuresAsPieces([measure], { gap: ' ', suffix: per === undefined ? '' : `/${per}` });
  },
});
