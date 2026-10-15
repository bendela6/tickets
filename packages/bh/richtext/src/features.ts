/**
 * What an editor can do, switched on one by one. Apps store lists of these
 * (a field's config), so a name never changes.
 */
export type Feature =
  | 'marks'
  | 'link'
  | 'headings'
  | 'lists'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock'
  | 'table'
  | 'details'
  | 'callout'
  | 'align'
  | 'image'
  | 'mentions'
  | 'divider';

/** Every feature, in toolbar order. */
export const ALL_FEATURES: Feature[] = [
  'marks',
  'link',
  'headings',
  'lists',
  'taskList',
  'blockquote',
  'codeBlock',
  'table',
  'details',
  'callout',
  'align',
  'image',
  'mentions',
  'divider',
];

/** `full` for a document, `compact` for a comment. */
export const PRESETS: { full: Feature[]; compact: Feature[] } = {
  full: ALL_FEATURES,
  compact: ['marks', 'link', 'lists', 'taskList', 'codeBlock', 'mentions', 'image'],
};
