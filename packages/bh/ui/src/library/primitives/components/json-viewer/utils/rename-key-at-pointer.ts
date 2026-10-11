import { parentPointer } from './parent-pointer';
import { setAtPointer } from './set-at-pointer';
import { valueAtPointer } from './value-at-pointer';

/**
 * Renames the key a pointer names, in place.
 *
 * In place is the whole point: the object is rebuilt entry by entry with the one key swapped, so
 * the renamed member stays where it was. Deleting and re-adding would be shorter and would send
 * the member to the bottom of the object, which is not what renaming a key means.
 *
 * A name a sibling already holds is refused, and so is an empty one - the document comes back
 * untouched, because writing either would silently drop a member.
 */
export function renameKeyAtPointer(root: unknown, pointer: string, nextKey: string): unknown {
  const place = parentPointer(pointer);
  if (place === null || nextKey === '' || nextKey === place.token) {
    return root;
  }
  const container = valueAtPointer(root, place.parent);
  if (container === null || typeof container !== 'object' || Array.isArray(container)) {
    return root;
  }
  const record = container as Record<string, unknown>;
  if (!Object.hasOwn(record, place.token) || Object.hasOwn(record, nextKey)) {
    return root;
  }
  const renamed = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key === place.token ? nextKey : key, value]),
  );
  return setAtPointer(root, place.parent, renamed);
}
