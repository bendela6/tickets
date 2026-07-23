import { buildExtensions, PRESETS, toDisplayDoc } from '@tickets/richtext';
import { EditorContent, useEditor } from '@tiptap/react';
import { cn } from '../../ui/cn';

type RichTextViewProps = {
  value: string;
  className?: string;
};

// Superset rendering rule: views always load the FULL schema so any stored
// doc renders correctly, regardless of the editing surface's feature config
// (e.g. a doc saved with the full editor still renders in a compact view).
export function RichTextView({ value, className }: RichTextViewProps) {
  const editor = useEditor({
    extensions: buildExtensions(PRESETS.full),
    content: toDisplayDoc(value),
    editable: false,
    immediatelyRender: true,
  });
  return <EditorContent editor={editor} className={cn('rt', className)} />;
}
