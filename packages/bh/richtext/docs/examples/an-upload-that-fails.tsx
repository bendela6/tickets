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
