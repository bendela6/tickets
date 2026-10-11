import { useState } from 'react';
import { Input } from '@bh/ui';

export function CharacterCount() {
  const [title, setTitle] = useState('Summer in the mountains');
  return (
    <div className="w-256">
      <Input aria-label="Title" value={title} onChange={setTitle} maxLength={40} showCount />
    </div>
  );
}
