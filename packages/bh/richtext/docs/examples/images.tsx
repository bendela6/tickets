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
