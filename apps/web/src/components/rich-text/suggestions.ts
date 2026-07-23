import type { SuggestionHooks } from '@tickets/richtext';

// Task 9 wires real @-mention/#-ticket-ref suggestion popovers. Until then this
// is an honest no-op: RichTextEditor threads the `suggestions` prop through so
// call sites can start passing user/ticket lookups now without a second wiring
// pass later, but no suggestion UI is attached yet.
export type RichTextSuggestions = {
  users?: () => { id: number; label: string }[];
  tickets?: (query: string) => { id: number | null; label: string; title?: string }[];
};

export function buildSuggestionHooks(_suggestions?: RichTextSuggestions): SuggestionHooks {
  return {};
}
