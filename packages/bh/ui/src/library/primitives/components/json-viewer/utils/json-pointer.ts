/**
 * A child's identity inside its parent, escaped the way RFC 6901 escapes a pointer so that a key
 * containing a slash cannot collide with a level of nesting. It is a React key and a member of the
 * fold set, never something anyone reads.
 */
export function jsonPointer(parent: string, token: string): string {
  return `${parent}/${token.replace(/~/g, '~0').replace(/\//g, '~1')}`;
}
