import * as v from 'valibot';
import { readableLocale } from './date-locale';
import type { FormatPiece } from './pieces';
import type { FormatContext, FormatValue } from './registry';

/** Most digits after the point: 0 to 20. */
export const digits = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(20));

/** The value as text. A list or an object as JSON. */
export function asText(value: FormatValue): string {
  if (typeof value === 'string') {
    return value;
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** The value as one piece. */
export function plainPieces(value: FormatValue): FormatPiece[] {
  return [{ text: asText(value) }];
}

/** Whether a Date reads the value. */
export function isMoment(value: FormatValue): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

/** Whether the value is a finite number. */
export function isNumber(value: FormatValue): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// Built once per locale and options: a table calls this once a cell.
const NUMBER_FORMATS = new Map<string, Intl.NumberFormat>();

function intlNumber(locale: string | undefined, options: Intl.NumberFormatOptions) {
  const key = `${locale ?? ''}|${JSON.stringify(options)}`;
  let format = NUMBER_FORMATS.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(readableLocale(locale) ?? 'en-US', options);
    NUMBER_FORMATS.set(key, format);
  }
  return format;
}

const NUMBER_PARTS = new Set<string>([
  'integer',
  'group',
  'decimal',
  'fraction',
  'minusSign',
  'plusSign',
  'nan',
  'infinity',
  'exponentSeparator',
  'exponentMinusSign',
  'exponentInteger',
]);

const UNIT_PARTS = new Set<string>(['compact', 'percentSign', 'currency', 'unit']);

/** A number part: digits, a unit, or the space between. */
function roleOf(type: string): 'number' | 'unit' | 'literal' {
  if (NUMBER_PARTS.has(type)) {
    return 'number';
  }
  return UNIT_PARTS.has(type) ? 'unit' : 'literal';
}

/** Intl's parts as pieces: digits joined, each unit apart. */
function piecesOfNumber(parts: readonly Intl.NumberFormatPart[]): FormatPiece[] {
  const pieces: FormatPiece[] = [];
  let before: ReturnType<typeof roleOf> | undefined;
  for (const { type, value } of parts) {
    const role = roleOf(type);
    const last = pieces.at(-1);
    if (last !== undefined && role === before && role !== 'unit') {
      last.text += value;
    } else {
      pieces.push(role === 'unit' ? { text: value, unit: true } : { text: value });
    }
    before = role;
  }
  return pieces;
}

/** A number written by Intl, as pieces. Anything else as its text. */
export function writeNumber(
  value: FormatValue,
  context: FormatContext,
  options: Intl.NumberFormatOptions,
): FormatPiece[] {
  return isNumber(value)
    ? piecesOfNumber(intlNumber(context.locale, options).formatToParts(value))
    : plainPieces(value);
}
