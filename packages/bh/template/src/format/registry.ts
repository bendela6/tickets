import * as v from 'valibot';
import { formatData, type FormatSpec, type Json } from '@bh/resource';
import { defineRegistry, type RegistryOf } from '@bh/registry';
import { functionSchema, optionsSchema } from '../registry';
import type { FormatPiece } from './pieces';

/** A value of its field's kind, never null. */
export type FormatValue = Exclude<Json, null>;

/** What the app sets once, for every format. */
export interface FormatContext {
  /** A BCP 47 tag: `de`, `en-GB`. Default English. */
  locale?: string;
  /** `UTC` or an IANA zone. Default the reader's. A format's own `timeZone` wins. */
  timeZone?: string;
  /** What relative times count from. Default now. */
  now?: Date;
}

/** No options. */
export type NoOptions = Record<string, never>;

/** A format: its spec and its function. `O` is its options. */
export interface Formatter<O = NoOptions> extends FormatSpec {
  /** Its options' schema. None: it takes none. */
  options?: v.GenericSchema<unknown, O>;
  /** The value as pieces. Gets checked options; `{}` when none. */
  format: (value: FormatValue, options: O, context: FormatContext) => FormatPiece[];
}

/** Formats by name. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormatRegistry = RegistryOf<Formatter<any>>;

/** What the registry checks of a format. */
const formatterData = v.object({
  ...formatData.entries,
  options: v.optional(optionsSchema),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  format: functionSchema<Formatter<any>['format']>('its format'),
});

/** The empty format registry. `define` types a format by its options. */
export const noFormats = defineRegistry({
  name: 'format',
  schema: formatterData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  define: <O>(format: Formatter<O>): Formatter<any> => format,
});
