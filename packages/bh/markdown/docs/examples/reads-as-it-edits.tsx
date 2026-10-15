import { useState } from 'react';
import { Prose } from '@bh/markdown';
import { RichTextEditor } from '@bh/richtext/editor';

const START = `## Opening hours

Open **every day** but Monday, from 9 to 18.

1. Ring the bell
2. Wait by the gate

Closed on public holidays.`;

export function ReadsAsItEdits() {
  const [text, setText] = useState(START);
  return (
    <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
      <RichTextEditor label="Opening hours" features="full" value={text} onChange={setText} />
      <Prose className="py-10">{text}</Prose>
    </div>
  );
}
