import { useState } from 'react';
import { RichTextEditor } from '@bh/richtext/editor';

export function AShortNote() {
  const [note, setNote] = useState('');
  return (
    <RichTextEditor
      label="Note"
      features="compact"
      size="xs"
      value={note}
      onChange={setNote}
      placeholder="Add a note…"
    />
  );
}
