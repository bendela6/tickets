/**
 * The container a pointer sits in and the token it sits under, or null for the root - which sits
 * in nothing, and so is the one value that can be neither renamed nor removed.
 */
export function parentPointer(pointer: string): { parent: string; token: string } | null {
  const at = pointer.lastIndexOf('/');
  if (at < 0) {
    return null;
  }
  return {
    parent: pointer.slice(0, at),
    token: pointer
      .slice(at + 1)
      .replace(/~1/g, '/')
      .replace(/~0/g, '~'),
  };
}
