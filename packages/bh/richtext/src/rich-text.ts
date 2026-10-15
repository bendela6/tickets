import type { AnyExtension } from '@tiptap/core';
import { buildExtensions, type BuildExtensionsOptions } from './build-extensions';
import { isDocEmpty, type DocNode } from './detect';
import { docToMarkdown } from './doc-to-markdown';
import { docToText } from './doc-to-text';
import type { Feature } from './features';
import type { InlineNode, SuggestionHooks } from './inline-node';
import { parseInline } from './inline-parse';
import { markdownToDoc, toDisplayDoc } from './markdown-to-doc';
import { mention } from './nodes/mention';

export interface RichTextOptions {
  /** The app's own inline nodes, beside mentions. */
  nodes?: readonly InlineNode[];
}

/**
 * The editor's extensions and the converters, all knowing the same inline
 * nodes, so what the editor writes, markdown reads back and search finds.
 */
export interface RichText {
  /**
   * The names of the inline nodes it knows, `mention` first: the keys an
   * editor's suggestions and `SuggestionHooks` take.
   */
  nodeNames: readonly string[];
  /** The Tiptap extensions for these features, with the inline nodes they turn on, each given `hooks[name]`. */
  buildExtensions: (
    features: readonly Feature[],
    hooks?: SuggestionHooks,
    options?: BuildExtensionsOptions,
  ) => AnyExtension[];
  /** Markdown as a document, the inline nodes read where their pattern matches. It never throws. */
  markdownToDoc: (md: string) => DocNode;
  /** A stored value as a document to show: the document itself, or its markdown converted. */
  toDisplayDoc: (text: string) => DocNode;
  /** One line of markdown as inline nodes. */
  parseInline: (source: string) => DocNode[];
  /** A document as the markdown `markdownToDoc` reads; what markdown can't hold degrades. */
  docToMarkdown: (doc: DocNode) => string;
  /** A document's plain text, one line per block; an inline node gives its words. */
  docToText: (doc: DocNode) => string;
  /** Whether the document holds no text, no image and no inline node. */
  isDocEmpty: (doc: DocNode) => boolean;
}

/**
 * The rich text an app writes, with its own inline nodes (a chip naming one of
 * its records) taken everywhere at once. An app makes it once and imports its
 * functions from there; an app with no nodes of its own takes the package's.
 */
export function createRichText({ nodes = [] }: RichTextOptions = {}): RichText {
  const all = [mention, ...nodes];
  for (const node of nodes) {
    if (all.filter((other) => other.name === node.name).length > 1) {
      throw new Error(`Two inline nodes are named "${node.name}".`);
    }
    // A global or sticky pattern matches from its lastIndex, and finds no place in a line.
    if (node.markdown && (node.markdown.pattern.global || node.markdown.pattern.sticky)) {
      throw new Error(`The inline node "${node.name}" has a global or sticky markdown pattern.`);
    }
  }
  return {
    nodeNames: all.map((node) => node.name),
    buildExtensions: (features, hooks, options) => buildExtensions(features, all, hooks, options),
    markdownToDoc: (md) => markdownToDoc(md, all),
    toDisplayDoc: (text) => toDisplayDoc(text, all),
    parseInline: (source) => parseInline(source, all),
    docToMarkdown: (doc) => docToMarkdown(doc, all),
    docToText: (doc) => docToText(doc, all),
    isDocEmpty: (doc) => isDocEmpty(doc, all),
  };
}
