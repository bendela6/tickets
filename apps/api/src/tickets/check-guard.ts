import { HttpError } from '../errors';

export type Guard = { requiresField?: string; requiresComment?: boolean };

export function checkGuard(
  guard: Guard | undefined,
  state: { hasField: (key: string) => boolean; commentCount: number },
): void {
  if (!guard) return;
  if (guard.requiresField && !state.hasField(guard.requiresField)) {
    throw new HttpError(422, `set "${guard.requiresField}" before this transition`);
  }
  if (guard.requiresComment && state.commentCount < 1) {
    throw new HttpError(422, 'add a comment explaining the resolution before closing');
  }
}
