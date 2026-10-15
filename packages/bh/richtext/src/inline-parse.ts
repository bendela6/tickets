import type { DocMark, DocNode } from './detect';
import type { InlineNode } from './inline-node';

interface Rule {
  pattern: RegExp;
  toNode: (match: RegExpMatchArray) => DocNode;
}

const text = (value: string, marks?: DocMark[]): DocNode => {
  return marks && marks.length > 0
    ? { type: 'text', text: value, marks }
    : { type: 'text', text: value };
};

/** Markdown's own inline syntax: a code span, an image, a link and the marks. */
const MARKDOWN_RULES: Rule[] = [
  { pattern: /`([^`]+)`/, toNode: (m) => text(m[1] ?? '', [{ type: 'code' }]) },
  {
    pattern: /!\[([^\]]*)\]\(([^)]+)\)/,
    toNode: (m) => ({ type: 'image', attrs: { src: m[2] ?? '', alt: m[1] ?? '' } }),
  },
  {
    pattern: /\[([^\]]+)\]\(([^)]+)\)/,
    toNode: (m) => text(m[1] ?? '', [{ type: 'link', attrs: { href: m[2] ?? '' } }]),
  },
  { pattern: /\*\*([^*]+)\*\*/, toNode: (m) => text(m[1] ?? '', [{ type: 'bold' }]) },
  { pattern: /~~([^~]+)~~/, toNode: (m) => text(m[1] ?? '', [{ type: 'strike' }]) },
  {
    pattern: /(?<![\w*])_([^_]+)_(?!\w)/,
    toNode: (m) => text(m[1] ?? '', [{ type: 'italic' }]),
  },
];

/**
 * A line of markdown as inline nodes. The match that starts first wins; two
 * starting at one place go to the earlier rule, markdown's own before the
 * inline nodes'.
 */
export function parseInline(source: string, nodes: readonly InlineNode[]): DocNode[] {
  const rules = [
    ...MARKDOWN_RULES,
    ...nodes.flatMap((node) => {
      return node.markdown ? [{ pattern: node.markdown.pattern, toNode: node.markdown.parse }] : [];
    }),
  ];
  return parse(source, rules);
}

function parse(source: string, rules: readonly Rule[]): DocNode[] {
  if (source.length === 0) {
    return [];
  }
  let best: { index: number; length: number; node: DocNode } | null = null;
  for (const rule of rules) {
    const match = source.match(rule.pattern);
    // An empty match would leave the rest of the line unchanged, and parse it forever.
    if (match?.index === undefined || match[0].length === 0) {
      continue;
    }
    if (best === null || match.index < best.index) {
      best = { index: match.index, length: match[0].length, node: rule.toNode(match) };
    }
  }
  if (best === null) {
    return [text(source)];
  }
  return [
    ...(best.index > 0 ? [text(source.slice(0, best.index))] : []),
    best.node,
    ...parse(source.slice(best.index + best.length), rules),
  ];
}
