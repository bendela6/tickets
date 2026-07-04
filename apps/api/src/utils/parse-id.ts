import { HttpError } from '../errors';

export function parseId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `invalid id "${raw}"`);
  }
  return id;
}
