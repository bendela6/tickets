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

/**
 * One control on an editor's toolbar. The groups run in this order, a
 * separator between each: block · marks · link · lists · blocks · insert ·
 * overflow. An `overflow` control is never a button on the strip; the editor
 * puts it in its "+" menu.
 */
export interface ToolbarControl {
  id: string;
  group: 'block' | 'marks' | 'link' | 'lists' | 'blocks' | 'insert' | 'overflow';
}

/** What a feature adds to an editor. */
export interface FeatureEntry {
  /** Its Tiptap extensions; none for what StarterKit already has (`buildExtensions` switches those). */
  extensions: () => AnyExtension[];
  /** Its toolbar controls. */
  toolbar: ToolbarControl[];
}

export const REGISTRY: Record<Feature, FeatureEntry> = {
  marks: {
    extensions: () => [TextStyle, Color, Highlight.configure({ multicolor: true })],
    toolbar: [
      { id: 'bold', group: 'marks' },
      { id: 'italic', group: 'marks' },
      { id: 'underline', group: 'marks' },
      { id: 'strike', group: 'marks' },
      { id: 'code', group: 'marks' },
      { id: 'highlight', group: 'overflow' },
      { id: 'color', group: 'overflow' },
    ],
  },
  link: { extensions: () => [LinkCursorDecoration], toolbar: [{ id: 'link', group: 'link' }] },
  // The leading block-type select (paragraph, H1, H2, H3): one control the
  // editor draws as a select, not a toggle.
  headings: { extensions: () => [], toolbar: [{ id: 'blockType', group: 'block' }] },
  lists: {
    extensions: () => [],
    toolbar: [
      { id: 'bulletList', group: 'lists' },
      { id: 'orderedList', group: 'lists' },
    ],
  },
  taskList: {
    extensions: () => [TaskList, TaskItem.configure({ nested: true })],
    toolbar: [{ id: 'taskList', group: 'lists' }],
  },
  blockquote: { extensions: () => [], toolbar: [{ id: 'blockquote', group: 'blocks' }] },
  codeBlock: { extensions: () => [], toolbar: [{ id: 'codeBlock', group: 'blocks' }] },
  // No control: a table comes in only through pasted markdown.
  table: {
    extensions: () => [Table, TableRow, TableHeader, TableCell],
    toolbar: [],
  },
  details: {
    extensions: () => [Details, DetailsSummary, DetailsContent],
    toolbar: [{ id: 'details', group: 'overflow' }],
  },
  callout: { extensions: () => [Callout], toolbar: [{ id: 'callout', group: 'overflow' }] },
  // No control either: alignment is kept in the schema so stored documents keep theirs.
  align: {
    extensions: () => [TextAlign.configure({ types: ['heading', 'paragraph'] })],
    toolbar: [],
  },
  image: { extensions: () => [Image], toolbar: [{ id: 'image', group: 'insert' }] },
  // Its node is `mention`, an inline node like an app's own (nodes/mention.ts),
  // which buildExtensions adds while this is on. The `@` button starts a
  // mention; the editor draws it while the app suggests people.
  mentions: { extensions: () => [], toolbar: [{ id: 'at', group: 'link' }] },
  divider: { extensions: () => [], toolbar: [{ id: 'horizontalRule', group: 'overflow' }] },
};
