---
title: The composer
summary: The editor as a comment box, its toolbar in a row under the text beside
  a submit button, and ⌘↩ to send.
order: 7
related: [RichTextEditor, The toolbar, Kbd, Button]
---

[//]: # 'written from composer.doc.yaml by pnpm docs:sync; edit that file, not this one'

# The composer

The editor as a comment box, its toolbar in a row under the text beside
a submit button, and ⌘↩ to send.

`composer` makes it one: the toolbar moves to a row under the text,
beside a ⌘↩ hint and a submit button, and ⌘↩ (Ctrl+Enter elsewhere)
sends the text rather than breaking the line.

## Examples

A reply box. `onSubmit` gets the live document's JSON, read at the
press; the page sends it, shows it pending with `submitPending`, and
clears the box by setting `value` to `''`.

**A comment box**

```tsx
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
```

## Sending

```tsx
import { useState } from 'react';
import { RichTextEditor } from '@bh/richtext/editor';

// The app's: how a comment is posted, and whether someone is signed in.
declare function usePostComment(): {
  mutate: (body: string, options: { onSuccess: () => void }) => void;
  isPending: boolean;
};
declare const signedIn: boolean;

export function CommentBox() {
  const [draft, setDraft] = useState('');
  const post = usePostComment();
  return (
    <RichTextEditor
      label="Comment"
      features="compact"
      value={draft}
      onChange={setDraft}
      composer={{
        onSubmit: (body) => post.mutate(body, { onSuccess: () => setDraft('') }),
        submitLabel: 'Comment',
        submitPending: post.isPending,
        submitDisabled: !signedIn,
      }}
    />
  );
}
```

It sends what the editor holds at the press, so a page that renders a
few edits behind the typing still sends every word. Nothing is sent:

- while the text holds nothing;
- while `submitPending` or `submitDisabled` is set, which the button
  shows: a spinner, or off;
- on a held key's repeats, nor on a second press before the page has
  caught up. Once sent, the text goes again only after it changes, or
  after the page's pending send is over.

## Keyboard and accessibility

⌘↩ on a Mac, Ctrl+Enter elsewhere, sends from the text; outside a
composer the same keys break the line. The button says so to a screen
reader (`aria-keyshortcuts`), so the hint beside it, a `Kbd`, is hidden
from one. The button is a bh `Button`, `aria-busy` while pending. The
toolbar keeps its keys: one tab stop, now after the text.

## Rules

- The button's words are the page's, `submitLabel`, and "Send" without
  one.
- A disabled composer shows its button off; a read-only one shows no
  row, since it has nothing to send.
- A composer's text starts a line or two tall, since its row adds its
  own height.

## Types

```ts
interface Composer
```

The editor as a composer, a comment box: its toolbar in a row under the
text, beside a submit button and a ⌘↩ hint, and ⌘↩ (Ctrl+Enter elsewhere)
sending the text rather than breaking the line.

| Member                | Type                      | Default | Description                                                                                                                                                                                                                                           |
| --------------------- | ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onSubmit` (required) | `(value: string) => void` |         | Sends the text: the live document's JSON, as `onChange` reports it, read at the press, so it never waits on the page to catch up. Never called while the text holds nothing. The page clears the editor, once it is sent, by setting `value` to `''`. |
| `submitLabel`         | `string`                  |         | The submit button's words. By default "Send".                                                                                                                                                                                                         |
| `submitPending`       | `boolean`                 |         | While the text is on its way: the button shows it, and nothing sends again.                                                                                                                                                                           |
| `submitDisabled`      | `boolean`                 |         | Whether sending is off: the button is, and ⌘↩ does nothing.                                                                                                                                                                                           |
