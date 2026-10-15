// The editor's core, without React, so a server converts and searches text
// with it too: the features and their presets, the Tiptap extensions they
// make, the callout and mention nodes, markdown to a document and back, and a
// document's plain text. An app's own inline nodes come in through
// createRichText.
export {
  buildExtensions,
  docToMarkdown,
  docToText,
  isDocEmpty,
  markdownToDoc,
  parseInline,
  toDisplayDoc,
} from './plain';
export { createRichText, type RichText, type RichTextOptions } from './rich-text';
export type { InlineNode, SuggestionHooks } from './inline-node';
export { toolbarControls, type BuildExtensionsOptions } from './build-extensions';
export { DOC_SENTINEL, isRichDoc, parseDoc, type DocMark, type DocNode } from './detect';
export { ALL_FEATURES, PRESETS, type Feature } from './features';
export { REGISTRY, type FeatureEntry, type ToolbarControl } from './registry';
export { Callout, type CalloutKind } from './nodes/callout';
export { LinkCursorDecoration } from './nodes/link-decoration';
