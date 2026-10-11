/**
 * A key nothing in the object holds yet, for a member the reader has just added. Named rather than
 * blank so the new line reads as a real member the moment it appears - the reader renames it next,
 * and an empty key would be a member that cannot be pointed at until they do.
 */
export function nextKey(taken: readonly string[]): string {
  const held = new Set(taken);
  if (!held.has('newKey')) {
    return 'newKey';
  }
  let attempt = 2;
  while (held.has(`newKey${attempt}`)) {
    attempt += 1;
  }
  return `newKey${attempt}`;
}
