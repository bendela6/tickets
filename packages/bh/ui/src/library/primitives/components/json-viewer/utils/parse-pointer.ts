/**
 * The tokens of a JSON pointer, unescaped. The root is the empty pointer and has no tokens.
 *
 * `~1` before `~0`, which is the order RFC 6901 specifies and not an arbitrary one: unescaping
 * `~0` first would turn `~01` into `~1` and then into a slash the author never wrote.
 */
export function parsePointer(pointer: string): string[] {
  if (pointer === '') {
    return [];
  }
  return pointer
    .slice(1)
    .split('/')
    .map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));
}
