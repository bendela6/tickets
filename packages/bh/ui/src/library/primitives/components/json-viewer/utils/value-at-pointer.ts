import { parsePointer } from './parse-pointer';

/**
 * What sits at a pointer, or undefined when the pointer names nothing. Used to seed an editor with
 * the value it is about to replace, so editing starts from what is on screen rather than from
 * blank.
 */
export function valueAtPointer(root: unknown, pointer: string): unknown {
  let node = root;
  for (const token of parsePointer(pointer)) {
    if (Array.isArray(node)) {
      node = node[Number(token)];
      continue;
    }
    if (node !== null && typeof node === 'object') {
      node = (node as Record<string, unknown>)[token];
      continue;
    }
    return undefined;
  }
  return node;
}
