import type { JsonContainer, JsonRow } from '../types';
import { jsonPointer } from './json-pointer';
import { scalarToken } from './scalar-token';
import { unwrapToJson } from './unwrap-to-json';

/** RFC 6901 spells the whole document as the empty pointer. */
const ROOT_PATH = '';

/**
 * Flattens a value into the lines a pretty printer emits at two spaces a level, in document order.
 *
 * The walk is its own rather than a `JSON.stringify` round trip because it has to keep going
 * through the things stringify refuses: a cycle becomes a `[Circular]` leaf instead of a thrown
 * TypeError, and an `undefined` or a `NaN` is drawn where stringify would drop the key entirely.
 * A viewer is read to find out what an object *is*, so the holes are the interesting part.
 */
export function jsonRows(value: unknown): JsonRow[] {
  const rows: JsonRow[] = [];
  // Held only for the walk down. Two siblings pointing at one object is sharing, not a cycle, so
  // an object leaves the set on the way back up.
  const openObjects = new Set<object>();

  function push(row: JsonRow): number {
    rows.push(row);
    return rows.length - 1;
  }

  function walk(
    raw: unknown,
    depth: number,
    path: string,
    key: string | null,
    comma: boolean,
  ): void {
    const node = unwrapToJson(raw);
    if (node === null || typeof node !== 'object') {
      push({ path, depth, key, value: scalarToken(node), container: null, close: null, comma });
      return;
    }
    if (openObjects.has(node)) {
      const circular = { text: '[Circular]', kind: 'invalid' } as const;
      push({ path, depth, key, value: circular, container: null, close: null, comma });
      return;
    }

    const isArray = Array.isArray(node);
    const entries: [string, unknown][] = isArray
      ? node.map((item, index) => [String(index), item])
      : Object.entries(node as Record<string, unknown>);
    // Held by reference so the closing row's index can be written back once it is known.
    const container: JsonContainer = {
      type: isArray ? 'array' : 'object',
      size: entries.length,
      closeRow: 0,
    };
    const openRow = push({ path, depth, key, value: null, container, close: null, comma });
    if (entries.length === 0) {
      // Nothing to fold away, so an empty container closes on the line it opened.
      container.closeRow = openRow;
      return;
    }

    openObjects.add(node);
    entries.forEach(([childKey, child], index) => {
      walk(
        child,
        depth + 1,
        jsonPointer(path, childKey),
        isArray ? null : childKey,
        index < entries.length - 1,
      );
    });
    openObjects.delete(node);
    container.closeRow = push({
      path,
      depth,
      key: null,
      value: null,
      container: null,
      close: isArray ? ']' : '}',
      comma,
    });
  }

  walk(value, 0, ROOT_PATH, null, false);
  return rows;
}
