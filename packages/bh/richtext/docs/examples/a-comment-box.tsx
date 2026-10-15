import { useState } from 'react';
import { Prose } from '@bh/markdown';
import { RichTextEditor } from '@bh/richtext/editor';

export function ACommentBox() {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string[]>([]);

  // As a request would: pending for a moment, then the box clears.
  const send = (body: string) => {
    setSending(true);
    setTimeout(() => {
      setSent((all) => [...all, body]);
      setDraft('');
      setSending(false);
    }, 700);
  };

  return (
    <div className="flex flex-col gap-12">
      {sent.map((body, index) => {
        return <Prose key={index}>{body}</Prose>;
      })}
      <RichTextEditor
        label="Reply"
        features="compact"
        value={draft}
        onChange={setDraft}
        placeholder="Write a reply…"
        composer={{ onSubmit: send, submitLabel: 'Reply', submitPending: sending }}
      />
    </div>
  );
}
