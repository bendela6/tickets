import type { JsonToken } from '../types';

/**
 * How one leaf is drawn. The values JSON has no spelling for — `undefined`, a function, `NaN`, a
 * bigint — are drawn as themselves and marked invalid rather than dropped: a viewer that silently
 * omitted them the way `JSON.stringify` does would be lying about the object it was handed.
 */
export function scalarToken(value: unknown): JsonToken {
  if (value === null) {
    return { text: 'null', kind: 'null' };
  }
  if (typeof value === 'string') {
    return { text: JSON.stringify(value), kind: 'string' };
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { text: String(value), kind: 'number' }
      : { text: String(value), kind: 'invalid' };
  }
  if (typeof value === 'boolean') {
    return { text: String(value), kind: 'boolean' };
  }
  if (typeof value === 'bigint') {
    return { text: `${value}n`, kind: 'invalid' };
  }
  if (typeof value === 'function') {
    return { text: 'function', kind: 'invalid' };
  }
  if (typeof value === 'symbol') {
    return { text: value.toString(), kind: 'invalid' };
  }
  return { text: 'undefined', kind: 'invalid' };
}
