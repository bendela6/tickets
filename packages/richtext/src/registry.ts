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

export type ToolbarControl = { id: string; group: 'marks' | 'blocks' | 'insert' };

export type FeatureEntry = {
  // StarterKit-covered features return []; standalone extensions return instances.
  extensions: () => AnyExtension[];
  toolbar: ToolbarControl[];
};

export const REGISTRY: Record<Feature, FeatureEntry> = {
  marks: {
    extensions: () => [TextStyle, Color, Highlight.configure({ multicolor: true })],
    toolbar: [
      { id: 'bold', group: 'marks' }, { id: 'italic', group: 'marks' },
      { id: 'underline', group: 'marks' }, { id: 'strike', group: 'marks' },
      { id: 'code', group: 'marks' }, { id: 'highlight', group: 'marks' },
      { id: 'color', group: 'marks' },
    ],
  },
  link: { extensions: () => [], toolbar: [{ id: 'link', group: 'marks' }] },
  headings: { extensions: () => [], toolbar: [{ id: 'heading', group: 'blocks' }] },
  lists: {
    extensions: () => [],
    toolbar: [{ id: 'bulletList', group: 'blocks' }, { id: 'orderedList', group: 'blocks' }],
  },
  taskList: {
    extensions: () => [TaskList, TaskItem.configure({ nested: true })],
    toolbar: [{ id: 'taskList', group: 'blocks' }],
  },
  blockquote: { extensions: () => [], toolbar: [{ id: 'blockquote', group: 'blocks' }] },
  codeBlock: { extensions: () => [], toolbar: [{ id: 'codeBlock', group: 'blocks' }] },
  table: {
    extensions: () => [Table, TableRow, TableHeader, TableCell],
    toolbar: [{ id: 'table', group: 'blocks' }],
  },
  details: {
    extensions: () => [Details, DetailsSummary, DetailsContent],
    toolbar: [{ id: 'details', group: 'blocks' }],
  },
  callout: { extensions: () => [], toolbar: [{ id: 'callout', group: 'blocks' }] }, // node added in Task 3
  align: {
    extensions: () => [TextAlign.configure({ types: ['heading', 'paragraph'] })],
    toolbar: [{ id: 'align', group: 'blocks' }],
  },
  image: { extensions: () => [Image], toolbar: [{ id: 'image', group: 'insert' }] },
  mentions: { extensions: () => [], toolbar: [] }, // configured per-surface in Task 3
  divider: { extensions: () => [], toolbar: [{ id: 'horizontalRule', group: 'blocks' }] },
};
