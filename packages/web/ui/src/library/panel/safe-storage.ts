// Panel persistence is a nice-to-have, not fatal. `localStorage` throws
// outright when site data is blocked (Chrome "block all cookies", an
// enterprise policy, a sandboxed iframe), and `setItem` throws again on a full
// quota. Both reads happen inside a `useState` initializer during render, so
// an unguarded throw takes down the whole subtree — a shell that can't
// remember its nav width must still render the app.
//
// Internal to the panel hooks: deliberately not re-exported from the package
// barrel, because "@tickets/ui owns your localStorage" is not an API.
export function readStored(key: string | undefined): string | null {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string | undefined, value: string): void {
  if (!key) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // See readStored.
  }
}
