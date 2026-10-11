import { jsonPointer } from './json-pointer';
import { nextKey } from './next-key';
import { setAtPointer } from './set-at-pointer';
import { valueAtPointer } from './value-at-pointer';

/** Where a new member landed, so the caller can put the cursor on it. */
export interface AddedMember {
  document: unknown;
  /** The pointer of the member just added, relative to the whole document. */
  pointer: string;
}

/**
 * Adds a member to the container a pointer names, at the end of it.
 *
 * At the end, always: an object has no order but its own, and dropping a new key in the middle
 * would rewrite lines the reader was not looking at. The member arrives as `null`, which is the
 * one value that is legal in every position and says plainly that it has not been filled in.
 *
 * Returns null when the pointer names something that is not a container - there is nothing to add
 * a member to.
 */
export function addMemberAtPointer(root: unknown, pointer: string): AddedMember | null {
  const container = valueAtPointer(root, pointer);
  if (Array.isArray(container)) {
    return {
      document: setAtPointer(root, pointer, [...container, null]),
      pointer: jsonPointer(pointer, String(container.length)),
    };
  }
  if (container === null || typeof container !== 'object') {
    return null;
  }
  const record = container as Record<string, unknown>;
  const key = nextKey(Object.keys(record));
  return {
    document: setAtPointer(root, pointer, { ...record, [key]: null }),
    pointer: jsonPointer(pointer, key),
  };
}
