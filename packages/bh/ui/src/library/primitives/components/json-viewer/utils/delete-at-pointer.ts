import { parsePointer } from './parse-pointer';

/**
 * Removes whatever a pointer names. An array member is spliced out, so everything after it shifts
 * down a place and the pointers the reader is looking at move with it - which is why the fold set
 * is keyed by pointer and re-derived from the new document rather than patched.
 *
 * The root cannot be deleted: there would be no document left. A pointer that names nothing leaves
 * the document alone.
 */
export function deleteAtPointer(root: unknown, pointer: string): unknown {
  const tokens = parsePointer(pointer);
  if (tokens.length === 0) {
    return root;
  }

  function remove(node: unknown, at: number): unknown {
    const token = tokens[at];
    if (token === undefined) {
      return node;
    }
    const last = at === tokens.length - 1;
    if (Array.isArray(node)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= node.length) {
        return node;
      }
      if (last) {
        return node.filter((_, position) => position !== index);
      }
      const copy = node.slice();
      copy[index] = remove(node[index], at + 1);
      return copy;
    }
    if (node !== null && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      if (!Object.hasOwn(record, token)) {
        return node;
      }
      if (last) {
        return Object.fromEntries(Object.entries(record).filter(([key]) => key !== token));
      }
      return { ...record, [token]: remove(record[token], at + 1) };
    }
    return node;
  }

  return remove(root, 0);
}
