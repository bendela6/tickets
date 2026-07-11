// Escape a string for embedding inside a double-quoted CSS attribute selector
// (entity ids / field names come from user JSON and may contain quotes).
export function cssEsc(s: string): string {
  return s.replace(/["\\]/g, '\\$&');
}
