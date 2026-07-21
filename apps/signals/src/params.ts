import { HttpError } from './errors';

// Parses a route/query id; rejects non-numeric, non-integer, unsafe (> 2^53) and non-positive values.
export function parseIntParam(value: string, label = 'id'): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new HttpError(400, `invalid ${label}`);
  return n;
}
