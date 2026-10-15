import { useState } from 'react';
import { RichTextEditor } from '@bh/richtext/editor';

export function SlashCommands() {
  const [page, setPage] = useState('');
  return (
    <RichTextEditor
      label="Page"
      features="full"
      slashCommands
      value={page}
      onChange={setPage}
      placeholder="Type / for a heading, a list, a callout…"
    />
  );
}
