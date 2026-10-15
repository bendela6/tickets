import type { AnyExtension } from '@tiptap/core';
import { Placeholder, type PlaceholderOptions } from '@tiptap/extension-placeholder';
import { StarterKit } from '@tiptap/starter-kit';
import type { Feature } from './features';
import type { InlineNode, SuggestionHooks } from './inline-node';
import { REGISTRY, type ToolbarControl } from './registry';

export interface BuildExtensionsOptions {
  /**
   * Shown while the editor is empty. A function is read on every redraw, so a
   * placeholder that changes (once a reply's author is picked, say) needs no
   * new extension list; an editor builds its list once.
   */
  placeholder?: PlaceholderOptions['placeholder'];
}

/** The Tiptap extensions for these features, with the inline nodes they turn on. */
export function buildExtensions(
  features: readonly Feature[],
  nodes: readonly InlineNode[],
  hooks?: SuggestionHooks,
  options?: BuildExtensionsOptions,
): AnyExtension[] {
  const on = new Set(features);
  const starterKit = StarterKit.configure({
    heading: on.has('headings') ? { levels: [1, 2, 3] } : false,
    bulletList: on.has('lists') ? undefined : false,
    orderedList: on.has('lists') ? undefined : false,
    listItem: on.has('lists') || on.has('taskList') ? undefined : false,
    blockquote: on.has('blockquote') ? undefined : false,
    codeBlock: on.has('codeBlock') ? undefined : false,
    horizontalRule: on.has('divider') ? undefined : false,
    bold: on.has('marks') ? undefined : false,
    italic: on.has('marks') ? undefined : false,
    strike: on.has('marks') ? undefined : false,
    code: on.has('marks') ? undefined : false,
    underline: on.has('marks') ? undefined : false,
    link: on.has('link') ? { openOnClick: false } : false,
  });
  const extra = features.flatMap((feature) => REGISTRY[feature].extensions());
  const inline = nodes
    .filter((node) => node.feature === undefined || on.has(node.feature))
    .flatMap((node) => node.extensions(hooks?.[node.name]));
  const placeholder = Placeholder.configure({
    placeholder: options?.placeholder ?? '',
    showOnlyWhenEditable: false,
  });
  return [starterKit, ...extra, ...inline, placeholder];
}

/** The toolbar controls of these features, in their order. */
export function toolbarControls(features: readonly Feature[]): ToolbarControl[] {
  return features.flatMap((feature) => REGISTRY[feature].toolbar);
}
