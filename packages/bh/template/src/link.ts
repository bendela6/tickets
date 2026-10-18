import type { FieldPath, Row, Template } from '@bh/resource';
import { fillText, textPaths } from './text';

// Where a link goes: a url's own address, or a route filled from the record,
// '/p/{project}/t/{number}'. A link renderer's `to`
// names the route, so a title or a key links to its row; how an app's router
// follows the address it gives is the app's.

/** Schemes a link never follows: they run code or carry a page of their own. */
const UNSAFE = new Set(['javascript', 'vbscript', 'data']);

/**
 * Whether a text is an address a link can go to: absolute, with its scheme
 * ('https://…', 'mailto:…'), or a path from the root ('/p/TIX'). Never '//…',
 * which names another host, a relative 'p/TIX', or a scheme that runs code
 * or carries a page of its own (javascript:, vbscript:, data:).
 */
export function isAddress(text: string): boolean {
  if (text.startsWith('/')) {
    return !text.startsWith('//');
  }
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(text)?.[1];
  return scheme !== undefined && !UNSAFE.has(scheme.toLowerCase());
}

/**
 * Whether a text is a route template a link can take as its `to`: its braces
 * pair (textPaths reads them) and it starts as an address does, a path from
 * the root or a scheme, before any placeholder.
 */
export function isRoute(to: string): boolean {
  try {
    textPaths(to);
  } catch {
    return false;
  }
  return isAddress(to);
}

/**
 * The value at a path, in a record: a field's key, or, for an object a field
 * holds (an entry of a repeat over a json list), its key and one of the
 * object's: 'services.name'.
 */
function valueAt(record: Row, path: FieldPath): unknown {
  if (Object.hasOwn(record, path)) {
    return record[path];
  }
  const dot = path.indexOf('.');
  const held = dot > 0 ? record[path.slice(0, dot)] : undefined;
  if (held === null || typeof held !== 'object' || Array.isArray(held)) {
    return undefined;
  }
  const key = path.slice(dot + 1);
  return Object.hasOwn(held, key) ? (held as Record<string, unknown>)[key] : undefined;
}

/**
 * A link's target, its route filled from the record: each placeholder the
 * value its path holds (an option its value, a ref its id), URL-encoded, so a
 * space or a slash in it can't break the address or lead elsewhere. Undefined,
 * so the part links nowhere, when a placeholder's value is empty or no single
 * value (a list, an object), as a templated url field is empty then; when the
 * route is malformed; and when what it fills is no address (isAddress).
 */
export function linkTarget(to: Template, record: Row): string | undefined {
  let missing = false;
  let filled: string;
  try {
    filled = fillText(to, (path) => {
      const value = valueAt(record, path);
      const text =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : '';
      missing ||= text === '';
      return encodeURIComponent(text);
    });
  } catch {
    return undefined;
  }
  return missing || !isAddress(filled) ? undefined : filled;
}
