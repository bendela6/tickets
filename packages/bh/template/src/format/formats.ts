import * as v from 'valibot';
import { baseKinds, type FieldFormat, type KindRegistry } from '@bh/resource';
import { named } from '../registry';
import type { FormatPiece } from './pieces';
import type { FormatContext, FormatRegistry, FormatValue } from './registry';
import { plainPieces } from './write';

/**
 * A value as pieces in a format. An unknown format, or refused options, give
 * the value's own text.
 *
 * @param formats The format registry: `baseFormats`, or an app's.
 * @param format A format's name, or its name and options. None: the value's text.
 * @param value One value of the field's kind.
 * @param context The app's locale, time zone and now.
 */
export function formatValue(
  formats: FormatRegistry,
  format: FieldFormat | undefined,
  value: FormatValue,
  context: FormatContext = {},
): FormatPiece[] {
  const name = format === undefined ? undefined : named(format).name;
  const entry = name !== undefined && formats.has(name) ? formats.get(name) : undefined;
  if (format === undefined || entry === undefined) {
    return plainPieces(value);
  }
  if (entry.options === undefined) {
    return entry.format(value, {}, context);
  }
  const options = v.safeParse(entry.options, named(format).options);
  return options.success ? entry.format(value, options.output, context) : plainPieces(value);
}

/**
 * Throws when a kind's default format is missing, or doesn't take the kind.
 *
 * @param formats The format registry: `baseFormats`, or an app's.
 * @param kinds The app's kinds. Default bh's.
 */
export function checkFormats(formats: FormatRegistry, kinds: KindRegistry = baseKinds): void {
  for (const kind of kinds.values()) {
    if (kind.format === undefined) {
      continue;
    }
    const entry = formats.has(kind.format) ? formats.get(kind.format) : undefined;
    if (entry === undefined) {
      throw new Error(
        `The kind "${kind.name}" shows in the format "${kind.format}" unless a field names another, but no format is registered by that name.`,
      );
    }
    if (!entry.kinds.includes(kind.name)) {
      throw new Error(
        `The kind "${kind.name}" shows in the format "${kind.format}", which takes ${entry.kinds.map((each) => `"${each}"`).join(', ')} and not "${kind.name}".`,
      );
    }
  }
}
