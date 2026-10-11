import {
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  Scalar,
  visit,
  type Document,
  type Node as YamlNode,
} from 'yaml';
import { normalise } from '../parse/markdown';
import type { AnyRenderer, BlockNode } from '../registry/types';

// The writer for a page written in YAML: the editor's changes applied
// through `yaml`'s document API, so whatever they don't touch (comments,
// quoting, layout) stays as it was written.

/**
 * One change to a page. An item is named by its place in `body`, and given
 * as a page writes it: a string for prose, `{ h2: 'Props' }` for a heading,
 * `{ callout: {…} }` or `{ example: 'examples/a.tsx', mode: 'split' }` for a
 * block (see `pageItem`).
 */
export type PageEdit =
  /** The item at `index` becomes `item`; what is unchanged in it keeps its comments. */
  | { op: 'set'; index: number; item: unknown }
  /** `item` goes in at `index`, before what is there; the length appends it. */
  | { op: 'insert'; index: number; item: unknown }
  /** The item at `index` goes, with the comments above it. */
  | { op: 'remove'; index: number }
  /** The item at `from` ends up at `to`. */
  | { op: 'move'; from: number; to: number }
  /** A frontmatter field; `undefined` removes it. */
  | { op: 'meta'; key: string; value: unknown };

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isScalarValue = (value: unknown): boolean => {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
};

/** Prose is always written with `|`, ending in a newline so the `|` needs no `-`. */
function asProse(scalar: Scalar): void {
  scalar.type = Scalar.BLOCK_LITERAL;
  const text = String(scalar.value);
  scalar.value = text.endsWith('\n') ? text : `${text}\n`;
}

/** A new node for `value`: text over more than one line is written with `|`. */
function nodeOf(doc: Document, value: unknown, top: boolean): YamlNode {
  const node = doc.createNode(value) as YamlNode;
  visit(node, {
    Scalar(_, scalar) {
      if (typeof scalar.value === 'string' && scalar.value.includes('\n')) {
        scalar.type = Scalar.BLOCK_LITERAL;
      }
    },
  });
  if (top && isScalar(node) && typeof node.value === 'string') {
    asProse(node);
  }
  return node;
}

const firstKey = (value: unknown): unknown => {
  if (isMap(value)) {
    const [first] = value.items;
    return isScalar(first?.key) ? first.key.value : first?.key;
  }
  return isPlain(value) ? Object.keys(value)[0] : undefined;
};

/**
 * `node` changed to hold `value`, in place where it can be, so what didn't
 * change keeps its comments and style; a new node where it can't. A `top`
 * item that names another block becomes a new item.
 */
function merged(doc: Document, node: unknown, value: unknown, top: boolean): YamlNode {
  if (isPlain(value) && isMap(node) && (!top || firstKey(node) === firstKey(value))) {
    const entries = Object.entries(value).filter(([, child]) => child !== undefined);
    for (const [key, child] of entries) {
      const current: unknown = node.get(key, true);
      if (current === undefined) {
        node.set(key, nodeOf(doc, child, false));
      } else {
        const next = merged(doc, current, child, false);
        if (next !== current) {
          node.set(key, next);
        }
      }
    }
    const keep = new Set(entries.map(([key]) => key));
    for (const pair of [...node.items]) {
      const key = isScalar(pair.key) ? pair.key.value : pair.key;
      if (!keep.has(String(key))) {
        node.delete(pair.key);
      }
    }
    return node;
  }
  if (Array.isArray(value) && isSeq(node)) {
    value.forEach((child, index) => {
      node.items[index] =
        index < node.items.length
          ? merged(doc, node.items[index], child, false)
          : nodeOf(doc, child, false);
    });
    node.items.splice(value.length);
    return node;
  }
  if (isScalar(node) && isScalarValue(value)) {
    if (node.value !== value) {
      node.value = value;
      if (typeof value === 'string' && value.includes('\n')) {
        node.type = Scalar.BLOCK_LITERAL;
      }
    }
    if (top && typeof value === 'string') {
      asProse(node);
    }
    return node;
  }
  return nodeOf(doc, value, top);
}

function checkIndex(index: number, length: number, what: string): void {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    throw new RangeError(`${what} ${index} is not an item of the page: it has ${length}`);
  }
}

/**
 * The page with `edits` applied in order, as YAML. Throws on a page that
 * doesn't parse, or an edit naming an item it doesn't have.
 */
export function editPage(source: string, edits: readonly PageEdit[]): string {
  const doc = parseDocument(normalise(source));
  const [error] = doc.errors;
  if (error) {
    throw new Error(`The page doesn't parse: ${error.message}`);
  }
  // Widened, so a field can be named by a string and a new one added.
  const root: unknown = doc.contents;
  if (!isMap(root)) {
    throw new Error('A page is a mapping: its title, summary and the rest, then `body`');
  }
  const body: unknown = root.get('body', true);
  if (!isSeq(body)) {
    throw new Error('A page has a `body`: a list of prose and blocks');
  }
  const { items } = body;

  for (const edit of edits) {
    switch (edit.op) {
      case 'set':
        checkIndex(edit.index, items.length, 'Item');
        items[edit.index] = merged(doc, items[edit.index], edit.item, true);
        break;
      case 'insert':
        checkIndex(edit.index, items.length + 1, 'Place');
        items.splice(edit.index, 0, nodeOf(doc, edit.item, true));
        break;
      case 'remove':
        checkIndex(edit.index, items.length, 'Item');
        items.splice(edit.index, 1);
        break;
      case 'move': {
        checkIndex(edit.from, items.length, 'Item');
        checkIndex(edit.to, items.length, 'Place');
        const [moved] = items.splice(edit.from, 1);
        items.splice(edit.to, 0, moved);
        break;
      }
      case 'meta': {
        if (edit.key === 'body') {
          throw new Error('`body` is the page itself, not a frontmatter field');
        }
        if (edit.value === undefined) {
          root.delete(edit.key);
          break;
        }
        const current: unknown = root.get(edit.key, true);
        if (current !== undefined) {
          root.set(edit.key, merged(doc, current, edit.value, false));
          break;
        }
        // A new field goes with the others, above `body`.
        const pair = doc.createPair(edit.key, nodeOf(doc, edit.value, false));
        const at = root.items.findIndex((item) => {
          return (isScalar(item.key) ? item.key.value : item.key) === 'body';
        });
        root.items.splice(at, 0, pair);
        break;
      }
    }
  }
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false });
}

/**
 * A parsed block as a page writes it: its name holding its body (or its
 * main attribute), then its other attributes, typed as the renderer
 * declares them. What `editPage` takes as an item.
 */
export function pageItem(node: BlockNode, renderer: AnyRenderer): Record<string, unknown> {
  const declared = renderer.attributes ?? {};
  const typed = (key: string, raw: string | true | undefined): unknown => {
    const type = declared[key]?.type;
    if (raw === undefined || raw === true) {
      return raw;
    }
    if (type === 'number') {
      return Number(raw);
    }
    return type === 'boolean' ? raw === 'true' : raw;
  };
  let body: unknown;
  if (renderer.main) {
    body = typed(renderer.main, node.attrs[renderer.main]);
  } else if (renderer.body === 'data') {
    body = node.data;
  } else if (node.text !== undefined) {
    body = node.text;
  } else {
    throw new Error(`${node.name}'s body is a list of items, which pageItem doesn't write back`);
  }
  const attrs = Object.entries(node.attrs)
    .filter(([key]) => key !== renderer.main)
    .map(([key, raw]) => [key, typed(key, raw)]);
  return Object.fromEntries([[node.name, body], ...attrs]);
}
