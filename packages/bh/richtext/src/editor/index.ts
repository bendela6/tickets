// The editor, drawn with React: `@bh/richtext/editor`. It sits on the core
// (the package's root entry, which imports no React, so servers take it) and
// on @bh/ui, whose field it wears.
export { RichTextEditor, type RichTextEditorProps } from './rich-text-editor';
export type { Composer } from './composer';
export type { UploadImage } from './image-upload';
export {
  SLASH_COMMANDS,
  type SlashCommand,
  type SuggestionItem,
  type SuggestionSource,
} from './suggestions';
// A `/` command runs on Tiptap's editor.
export type { Editor } from '@tiptap/react';
