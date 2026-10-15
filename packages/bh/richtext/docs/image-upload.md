---
title: Images
summary: Images pasted, dropped or picked, each held in its place with its
  progress while the app uploads it.
order: 6
related: [RichTextEditor, Suggestions, Progress]
---

[//]: # 'written from image-upload.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Images

Images pasted, dropped or picked, each held in its place with its
progress while the app uploads it.

With the `image` feature, the app's `uploadImage` takes images in: it
gets the file and a `progress` callback (0 to 100), and resolves to the
address the image is shown from. The editor stores that address on the
image, never the file.

## Examples

Paste an image, drop one on the text, or pick one with the toolbar's
Image (or `/` Image). While it goes up, a card in its place shows its
name and progress; the text around it can be edited, and the image goes
in where its place has moved to, leaving the caret where it is.

**Images**

```tsx
import { useState } from 'react';
import { RichTextEditor, type UploadImage } from '@bh/richtext/editor';

// Reads the file in place of an upload, a tenth at a time, for the example.
const upload: UploadImage = (file, progress) => {
  return new Promise((resolve) => {
    let done = 0;
    const step = setInterval(() => {
      done += 10;
      progress(done);
      if (done === 100) {
        clearInterval(step);
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      }
    }, 120);
  });
};

export function Images() {
  const [story, setStory] = useState('');
  return (
    <RichTextEditor
      label="Story"
      features="full"
      uploadImage={upload}
      value={story}
      onChange={setStory}
      placeholder="Paste or drop an image, or pick one with the toolbar’s Image…"
    />
  );
}
```

A rejected upload leaves a card saying it failed, with the error's
message, Retry and Remove, and the text untouched.

**An upload that fails**

```tsx
import { useState } from 'react';
import { RichTextEditor, type UploadImage } from '@bh/richtext/editor';

const upload: UploadImage = (_file, progress) => {
  progress(40);
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error('The file is larger than 5 MB.')), 800);
  });
};

export function AnUploadThatFails() {
  const [story, setStory] = useState('');
  return (
    <RichTextEditor
      label="Story"
      features="full"
      uploadImage={upload}
      value={story}
      onChange={setStory}
      placeholder="Every image is refused here: pick one to see the card."
    />
  );
}
```

## Uploading

```tsx
import { useState } from 'react';
import { RichTextEditor } from '@bh/richtext/editor';

// The app's: sends a file, reports how far along it is, gives its address.
declare const api: {
  upload: (file: File, options: { onProgress: (percent: number) => void }) => Promise<string>;
};

export function Story() {
  const [story, setStory] = useState('');
  return (
    <RichTextEditor
      label="Story"
      features="full"
      uploadImage={(file, progress) => api.upload(file, { onProgress: progress })}
      value={story}
      onChange={setStory}
    />
  );
}
```

`uploadImage` is read when an image comes in, so a new function each
render needs no new editor. Several images at once go up side by side,
each in its own card.

## Keyboard and accessibility

The toolbar's Image opens the browser's file picker, for images only,
several at once. A card's progress is a `progressbar` named "Uploading"
and the file's name; a failed card is an `alert`, so its message is read
out, and its Retry and Remove are buttons.

## Rules

- With no `uploadImage`, nothing offers an image: no toolbar button, no
  `/` Image, and a pasted or dropped image file goes nowhere.
- Nothing is in the document until the image is up: a card is the
  editor's, not the text's, so a failed upload leaves nothing behind.
- An image already in a document stays, whatever the editor's upload.

## Types

```ts
type UploadImage = (file: File, progress: (percent: number) => void) => Promise<string>;
```

Where the app puts an image: it takes the file, reports how far along it is
(0 to 100) if it can, and resolves to the address the image is shown from.
A rejection is a failed upload, its message shown.
