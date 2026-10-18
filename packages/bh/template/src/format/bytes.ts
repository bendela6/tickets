// A size in bytes as a person reads it: `1.5 KiB`, `64 MiB`, `2.1 GiB`.
//
// The apps each wrote their own, and no two agreed. signals, medialib and
// items-core's crawls counted in 1024s but wrote KB and MB, stopping at TB or
// PB; cv wrote whole KB under a megabyte and MB above, and stopped there;
// items-core's size limits wrote KiB and MiB, a whole number without its
// `.0`; FileInput kept one decimal under ten and none above. What they share
// is a step of 1024, a space before the unit, whole bytes, and a decimal at
// most past them.
//
// So the step is a choice, and each step is written with its own names:
// 1024 as IEC writes it (`KiB`), 1000 as SI does (`kB`). A `KB` that means
// 1024 to one reader and 1000 to the next is the one spelling left out.

import type { Measure } from './pieces';

/** How `formatBytes` writes a size. */
export interface FormatBytesOptions {
  /**
   * How many bytes make the next unit, and the names the units take:
   * `binary`, 1024, written `KiB`, `MiB`, `GiB` as IEC writes them; or
   * `decimal`, 1000, written `kB`, `MB`, `GB` as SI does, as a disk's label
   * and macOS count.
   *
   * Binary unless given: every app that wrote its own counted in 1024s, so
   * the numbers they show stay as they were.
   */
  units?: 'binary' | 'decimal';
  /**
   * The most digits after the point, past whole bytes: `1.46 KiB` with 2,
   * `1 KiB` with 0. A whole amount drops its zeros, so `64 MiB`, not
   * `64.0 MiB`.
   */
  digits?: number;
}

/** Bytes to the next unit, and the names the units take, up to an exabyte. */
const SCALES = {
  binary: { step: 1024, names: ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'] },
  decimal: { step: 1000, names: ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB'] },
} as const;

/** `digits` as `toFixed` takes it: a whole number from 0 to 20. */
function placesOf(digits: number): number {
  return Math.min(Math.max(Math.trunc(digits) || 0, 0), 20);
}

/**
 * A size in bytes as its number and its unit, in the largest unit that keeps
 * it at one or more: what `formatBytes` joins with a space, and the bytes
 * format hands back apart. Undefined for a number that is not finite, which
 * has no unit.
 */
export function sizeOf(
  bytes: number,
  { units = 'binary', digits = 1 }: FormatBytesOptions = {},
): Measure | undefined {
  if (!Number.isFinite(bytes)) {
    return undefined;
  }
  // Read so a `units` that came from data and names neither is binary.
  const { step, names } = units === 'decimal' ? SCALES.decimal : SCALES.binary;
  const places = placesOf(digits);
  const size = Math.abs(bytes);
  let unit = 0;
  let shown = Math.round(size);
  // Rounded before it is compared, so a size that rounds to a whole step
  // moves up a unit rather than reading `1024 KiB`.
  while (shown >= step && unit < names.length - 1) {
    unit += 1;
    shown = Number((size / step ** unit).toFixed(places));
  }
  return { amount: `${bytes < 0 && shown > 0 ? '-' : ''}${shown}`, unit: names[unit] ?? '' };
}

/**
 * A size in bytes in the largest unit that keeps it at one or more, to one
 * decimal: `1536` is `1.5 KiB`, `67108864` is `64 MiB`. Under one unit it is
 * whole bytes, `512 B`, since a byte does not split.
 *
 * A size that rounds up to the next unit is written in it: `1048570` is
 * `1 MiB`, never `1024 KiB`. A negative size keeps its sign, for a change in
 * size; a number that is not finite comes back as `String` writes it.
 *
 * @param bytes The size, in bytes.
 * @param options Binary or decimal units, and how many digits after the point.
 */
export function formatBytes(
  bytes: number,
  { units = 'binary', digits = 1 }: FormatBytesOptions = {},
): string {
  const size = sizeOf(bytes, { units, digits });
  return size === undefined ? String(bytes) : `${size.amount} ${size.unit}`;
}
