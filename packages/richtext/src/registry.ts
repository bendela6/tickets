import type { AnyExtension } from '@tiptap/core';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { Highlight } from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import type { Feature } from './features';
import { Callout } from './nodes/callout';
import { LinkCursorDecoration } from './nodes/link-decoration';
import { ticketRef, userMention, type SuggestionHooks } from './nodes/refs';

// Groups mirror RichTextEditor.dc.html's toolbar comment: "groups: block ·
// marks · link · lists · blocks · insert · overflow — separators collapse
// with their group". 'overflow' ids never render as strip buttons — the
// web Toolbar component (apps/web) routes them into the "+" menu instead.
export type ToolbarControl = {
  id: string;
  group: 'block' | 'marks' | 'link' | 'lists' | 'blocks' | 'insert' | 'overflow';
};

export type FeatureEntry = {
  // StarterKit-covered features return []; standalone extensions return instances.
  extensions: (hooks?: SuggestionHooks) => AnyExtension[];
  toolbar: ToolbarControl[];
};

export const REGISTRY: Record<Feature, FeatureEntry> = {
  marks: {
    extensions: () => [TextStyle, Color, Highlight.configure({ multicolor: true })],
    toolbar: [
      { id: 'bold', group: 'marks' }, { id: 'italic', group: 'marks' },
      { id: 'underline', group: 'marks' }, { id: 'strike', group: 'marks' },
      { id: 'code', group: 'marks' },
      // Highlight/text-color move to the "+" overflow menu per
      // RteToolbar.dc.html — they never render as strip buttons.
      { id: 'highlight', group: 'overflow' }, { id: 'color', group: 'overflow' },
    ],
  },
  link: { extensions: () => [LinkCursorDecoration], toolbar: [{ id: 'link', group: 'link' }] },
  // The old cycling H1 button is gone — 'headings' now contributes the
  // leading block-type select (Paragraph/H1/H2/H3), rendered by the web
  // layer as its own control, not a plain toggle button.
  headings: { extensions: () => [], toolbar: [{ id: 'blockType', group: 'block' }] },
  lists: {
    extensions: () => [],
    toolbar: [{ id: 'bulletList', group: 'lists' }, { id: 'orderedList', group: 'lists' }],
  },
  taskList: {
    extensions: () => [TaskList, TaskItem.configure({ nested: true })],
    toolbar: [{ id: 'taskList', group: 'lists' }],
  },
  blockquote: { extensions: () => [], toolbar: [{ id: 'blockquote', group: 'blocks' }] },
  codeBlock: { extensions: () => [], toolbar: [{ id: 'codeBlock', group: 'blocks' }] },
  // Table has no toolbar button in the design (full config: select, marks,
  // link, lists, quote/codeblock, img, +) — the extension stays available
  // for markdown-pasted tables, it's just never manually insertable.
  table: {
    extensions: () => [Table, TableRow, TableHeader, TableCell],
    toolbar: [],
  },
  details: {
    extensions: () => [Details, DetailsSummary, DetailsContent],
    toolbar: [{ id: 'details', group: 'overflow' }],
  },
  callout: { extensions: () => [Callout], toolbar: [{ id: 'callout', group: 'overflow' }] },
  // Alignment likewise has no toolbar surface in the design — schema-only.
  align: {
    extensions: () => [TextAlign.configure({ types: ['heading', 'paragraph'] })],
    toolbar: [],
  },
  image: { extensions: () => [Image], toolbar: [{ id: 'image', group: 'insert' }] },
  mentions: {
    extensions: (hooks) => [userMention(hooks?.mention), ticketRef(hooks?.ticketRef)],
    // '@' only ever appears in the compact composer strip (RteToolbar.dc.html
    // compactTools) — full config triggers mentions by typing '@' inline.
    // The web Toolbar filters this id out for the full variant.
    toolbar: [{ id: 'at', group: 'link' }],
  },
  divider: { extensions: () => [], toolbar: [{ id: 'horizontalRule', group: 'overflow' }] },
};
