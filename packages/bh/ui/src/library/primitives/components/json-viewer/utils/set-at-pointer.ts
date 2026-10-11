import { parsePointer } from './parse-pointer';

/**
 * Writes a value at a pointer, copying only the containers on the way down - everything off the
 * path keeps its identity, so React re-renders the branch that changed and nothing else.
 *
 * A pointer that runs into a scalar before it runs out of tokens names nothing, and the document
 * comes back untouched. That is a row the reader is looking at having stopped existing between the
 * render and the click, which is a no-op rather than an error.
 */
export function setAtPointer(root: unknown, pointer: string, next: unknown): unknown {
  const tokens = parsePointer(pointer);

  function write(node: unknown, at: number): unknown {
    const token = tokens[at];
    if (token === undefined) {
      return next;
    }
    if (Array.isArray(node)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= node.length) {
        return node;
      }
      const member = write(node[index], at + 1);
      // Unchanged in, unchanged out, all the way back up: a write that changed nothing - a stale
      // pointer, or a value set to what it already was - hands back the document it was given, so
      // it does not land on the undo stack or re-render a branch nobody touched.
      if (Object.is(member, node[index])) {
        return node;
      }
      const copy = node.slice();
      copy[index] = member;
      return copy;
    }
    if (node !== null && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      if (!Object.hasOwn(record, token)) {
        return node;
      }
      const member = write(record[token], at + 1);
      if (Object.is(member, record[token])) {
        return node;
      }
      // Reassigning a key it already has keeps that key where it was, so the document does not
      // reshuffle under the reader when a value is edited.
      return { ...record, [token]: member };
    }
    return node;
  }

  return write(root, 0);
}
