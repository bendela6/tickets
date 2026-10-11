import type { Attrs } from '../registry/types';

const TOKEN = /([A-Za-z][\w-]*)(?:=(?:"([^"]*)"|([^\s}]+)))?/g;

/** Reads `{type=warning title="Before you migrate" compact}` into an object. */
export function parseAttrs(input: string): Attrs {
  const inner = input.trim().replace(/^\{/, '').replace(/\}$/, '');
  const attrs: Attrs = {};
  for (const match of inner.matchAll(TOKEN)) {
    const [, key, quoted, bare] = match;
    if (key) {
      attrs[key] = quoted ?? bare ?? true;
    }
  }
  return attrs;
}
