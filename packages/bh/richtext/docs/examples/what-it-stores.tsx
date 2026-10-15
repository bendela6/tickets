import { useState } from 'react';
import { CodeBlock } from '@bh/code';
import { RichTextEditor } from '@bh/richtext/editor';

export function WhatItStores() {
  const [value, setValue] = useState('Edit **this**, and watch the value.');
  const shown = value === '' ? "''" : JSON.stringify(JSON.parse(value), null, 2);
  return (
    <div className="flex flex-col gap-12">
      <RichTextEditor label="Text" features="compact" value={value} onChange={setValue} />
      <CodeBlock lang="json" value={value.startsWith('{') ? shown : value} numbers={false} />
    </div>
  );
}
