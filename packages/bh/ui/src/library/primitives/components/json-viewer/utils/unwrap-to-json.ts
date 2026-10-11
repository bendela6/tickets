/**
 * What `JSON.stringify` would serialise in this value's place. A Date, a Temporal instant, a
 * Decimal — anything carrying a `toJSON` — hands back the value it wants to be read as, which is
 * the difference between a date reading as its ISO string and reading as the empty object its own
 * enumerable properties make it look like.
 *
 * Unwrapped once, not to a fixed point: a `toJSON` that returns another wrapper is pathological,
 * and a loop here would be a second way to hang on one.
 */
export function unwrapToJson(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const candidate = (value as { toJSON?: unknown }).toJSON;
  if (typeof candidate !== 'function') {
    return value;
  }
  return (candidate as (this: unknown) => unknown).call(value);
}
