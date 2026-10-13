import { tags, type Tag } from '@lezer/highlight';

/** What a run of code is, as far as its colour goes. */
export type SyntaxRole =
  'keyword' | 'type' | 'string' | 'number' | 'comment' | 'name' | 'punctuation';

/**
 * The one syntax map. Every piece of code a page shows (a code block, an
 * example's source, an editor) is coloured through these roles, so a fragment
 * on the page and the same text being edited look the same. Each role is an
 * Instrument class, so the colours theme with everything else.
 */
export const SYNTAX_CLASSES: Record<SyntaxRole, string> = {
  keyword: 'text-indigo-11',
  // Type names and JSX component names: the words a reader looks up.
  type: 'text-cyan-11',
  string: 'text-green-11',
  number: 'text-orange-11',
  comment: 'text-gray-9 italic',
  name: 'text-gray-12',
  punctuation: 'text-gray-10',
};

/** Which Lezer tags take which role. A tag's more specific kinds inherit it. */
export const SYNTAX_TAGS: readonly (readonly [Tag, SyntaxRole])[] = [
  [tags.keyword, 'keyword'],
  [tags.typeName, 'type'],
  [tags.tagName, 'type'],
  [tags.className, 'type'],
  [tags.string, 'string'],
  [tags.attributeValue, 'string'],
  [tags.regexp, 'string'],
  [tags.number, 'number'],
  [tags.bool, 'number'],
  [tags.null, 'number'],
  [tags.comment, 'comment'],
  [tags.propertyName, 'name'],
  [tags.attributeName, 'name'],
  [tags.function(tags.variableName), 'name'],
  [tags.punctuation, 'punctuation'],
  [tags.operator, 'punctuation'],
];
