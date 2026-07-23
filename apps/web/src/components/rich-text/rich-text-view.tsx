import { buildExtensions, PRESETS, toDisplayDoc } from '@tickets/richtext';
import { EditorContent, useEditor } from '@tiptap/react';
import type { MouseEvent } from 'react';
import { cn } from '../../ui/cn';

type RichTextViewProps = {
  value: string;
  className?: string;
  onOpenTicket?: (label: string) => void;
};

// Superset rendering rule: views always load the FULL schema so any stored
// doc renders correctly, regardless of the editing surface's feature config
// (e.g. a doc saved with the full editor still renders in a compact view).
export function RichTextView({ value, className, onOpenTicket }: RichTextViewProps) {
  const editor = useEditor({
    extensions: buildExtensions(PRESETS.full),
    content: toDisplayDoc(value),
    editable: false,
    immediatelyRender: true,
  });

  // Ticket-ref chips (rendered by @tickets/richtext as
  // `<span data-ticket-ref="TIX-42">`) aren't interactive elements — walk up
  // from whatever the click actually landed on (e.g. a text node's parent)
  // to find the chip.
  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!onOpenTicket) {
      return;
    }
    let node: HTMLElement | null = event.target as HTMLElement | null;
    while (node && node !== event.currentTarget) {
      const label = node.getAttribute('data-ticket-ref');
      if (label !== null) {
        onOpenTicket(label);
        return;
      }
      node = node.parentElement;
    }
  }

  return <EditorContent editor={editor} className={cn('rt', className)} onClick={handleClick} />;
}
