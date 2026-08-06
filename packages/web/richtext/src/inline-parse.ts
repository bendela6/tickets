import type { DocMark, DocNode } from './detect';

type Rule = { pattern: RegExp; toNode: (match: RegExpMatchArray) => DocNode | DocNode[] };

const text = (value: string, marks?: DocMark[]): DocNode =>
  marks && marks.length > 0 ? { type: 'text', text: value, marks } : { type: 'text', text: value };

const RULES: Rule[] = [
  { pattern: /`([^`]+)`/, toNode: (m) => text(m[1]!, [{ type: 'code' }]) },
  { pattern: /!\[([^\]]*)\]\(([^)]+)\)/, toNode: (m) => ({ type: 'image', attrs: { src: m[2]!, alt: m[1] ?? '' } }) },
  { pattern: /\[([^\]]+)\]\(([^)]+)\)/, toNode: (m) => text(m[1]!, [{ type: 'link', attrs: { href: m[2]! } }]) },
  { pattern: /\*\*([^*]+)\*\*/, toNode: (m) => text(m[1]!, [{ type: 'bold' }]) },
  { pattern: /~~([^~]+)~~/, toNode: (m) => text(m[1]!, [{ type: 'strike' }]) },
  { pattern: /(?<![\w*])_([^_]+)_(?!\w)/, toNode: (m) => text(m[1]!, [{ type: 'italic' }]) },
  { pattern: /(?<![\w#])#([A-Z][A-Z0-9]*-\d+)/, toNode: (m) => ({ type: 'ticketRef', attrs: { id: null, label: m[1]! } }) },
  {
    pattern: /(?<!\w)@([A-Za-z][\w-]*(?:\.[\w-]+)*)/,
    toNode: (m) => ({ type: 'mention', attrs: { id: null, label: m[1]! } }),
  },
];

export function parseInline(source: string): DocNode[] {
  if (source.length === 0) {
    return [];
  }
  let best: { index: number; length: number; nodes: DocNode[] } | null = null;
  for (const rule of RULES) {
    const match = source.match(rule.pattern);
    if (match?.index !== undefined && (best === null || match.index < best.index)) {
      const produced = rule.toNode(match);
      best = { index: match.index, length: match[0].length, nodes: Array.isArray(produced) ? produced : [produced] };
    }
  }
  if (best === null) {
    return [text(source)];
  }
  return [
    ...(best.index > 0 ? [text(source.slice(0, best.index))] : []),
    ...best.nodes,
    ...parseInline(source.slice(best.index + best.length)),
  ];
}
