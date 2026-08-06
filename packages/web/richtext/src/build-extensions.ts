import type { AnyExtension } from '@tiptap/core';
import { Placeholder, type PlaceholderOptions } from '@tiptap/extension-placeholder';
import { StarterKit } from '@tiptap/starter-kit';
import type { Feature } from './features';
import type { SuggestionHooks } from './nodes/refs';
import { REGISTRY, type ToolbarControl } from './registry';

export type BuildExtensionsOptions = {
  // Per-surface placeholder copy (e.g. detail-comments swaps its hint once a
  // user is picked). Accepts Tiptap's own string-or-function form so a
  // caller can pass a function that reads a ref instead of a frozen string —
  // that keeps the placeholder reactive without rebuilding the extension
  // list (buildExtensions is normally called once per mounted editor).
  placeholder?: PlaceholderOptions['placeholder'];
};

export function buildExtensions(
  features: Feature[],
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
  const extra = features.flatMap((feature) => REGISTRY[feature].extensions(hooks));
  const placeholder = Placeholder.configure({ placeholder: options?.placeholder ?? '', showOnlyWhenEditable: false });
  return [starterKit, ...extra, placeholder];
}

export function toolbarControls(features: Feature[]): ToolbarControl[] {
  return features.flatMap((feature) => REGISTRY[feature].toolbar);
}
