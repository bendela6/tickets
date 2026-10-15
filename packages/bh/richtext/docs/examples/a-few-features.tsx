import { useState } from 'react';
import { RichTextEditor } from '@bh/richtext/editor';

export function AFewFeatures() {
  const [caption, setCaption] = useState('A *quiet* street at dawn.');
  return (
    <RichTextEditor
      label="Caption"
      features={['marks', 'link', 'lists']}
      value={caption}
      onChange={setCaption}
    />
  );
}
