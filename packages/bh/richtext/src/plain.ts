import { createRichText } from './rich-text';

// Rich text with mentions and no inline nodes of an app's own. An app that
// has its own takes these from its createRichText instead.
export const {
  buildExtensions,
  markdownToDoc,
  toDisplayDoc,
  parseInline,
  docToMarkdown,
  docToText,
  isDocEmpty,
} = createRichText();
