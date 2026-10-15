import type { AnyExtension } from '@tiptap/core';
import type { SuggestionOptions } from '@tiptap/suggestion';
import type { DocNode } from './detect';
import type { Feature } from './features';

/**
 * An inline node beside the text, such as a chip naming a person or one of
 * the app's records. It is an atom, its attrs and no text inside. Mentions are
 * one; an app adds its own through `createRichText({ nodes })`, and the editor,
 * the markdown round trip and `docToText` all take them.
 */
export interface InlineNode {
  /** Its type in a document: the name its Tiptap extension gives it. */
  name: string;
  /** Its Tiptap extensions. `suggestion` is the app's hook for it, `hooks[name]`. */
  extensions: (suggestion?: Partial<SuggestionOptions>) => AnyExtension[];
  /** The feature that puts it in the editor. Without one it is always there. */
  feature?: Feature;
  /** How markdown writes it. Without this, markdown gets its text and reads that back as text. */
  markdown?: {
    /** Finds it in a line of text; the match becomes the node. Not global or sticky. */
    pattern: RegExp;
    parse: (match: RegExpMatchArray) => DocNode;
    serialize: (node: DocNode) => string;
  };
  /** The words it stands for in `docToText`, for search and excerpts. By default its `label`. */
  text?: (node: DocNode) => string;
}

/**
 * Each inline node's suggestion config, by the node's name: `mention` for `@`,
 * and an app's own nodes by theirs. The lookup (who can be mentioned, what can
 * be referenced) is the app's; a node with no hook opens no popup.
 */
export interface SuggestionHooks {
  mention?: Partial<SuggestionOptions>;
  [node: string]: Partial<SuggestionOptions> | undefined;
}

/** The words an inline node stands for. */
export function nodeText(spec: InlineNode, node: DocNode): string {
  return spec.text ? spec.text(node) : String(node.attrs?.['label'] ?? '');
}

/** The spec of an inline node in a document, if it is one. */
export function specOf(nodes: readonly InlineNode[], node: DocNode): InlineNode | undefined {
  return nodes.find((spec) => spec.name === node.type);
}
