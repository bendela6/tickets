export type Feature =
  | 'marks' | 'link' | 'headings' | 'lists' | 'taskList' | 'blockquote'
  | 'codeBlock' | 'table' | 'details' | 'callout' | 'align' | 'image'
  | 'mentions' | 'divider';

export const ALL_FEATURES: Feature[] = [
  'marks', 'link', 'headings', 'lists', 'taskList', 'blockquote',
  'codeBlock', 'table', 'details', 'callout', 'align', 'image',
  'mentions', 'divider',
];

export const PRESETS: { full: Feature[]; compact: Feature[] } = {
  full: ALL_FEATURES,
  compact: ['marks', 'link', 'lists', 'taskList', 'codeBlock', 'mentions', 'image'],
};
