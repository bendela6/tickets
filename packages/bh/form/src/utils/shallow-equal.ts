export function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  if (a === b) {
    return true;
  }
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) {
    return false;
  }
  for (const k of ak) {
    if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
}
