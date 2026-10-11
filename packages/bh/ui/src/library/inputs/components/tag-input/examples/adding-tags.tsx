import { useId, useState } from 'react';
import { FieldLabel, TagInput } from '@bh/ui';

export function AddingTags() {
  const id = useId();
  const [tags, setTags] = useState<string[]>(['apple', 'pear']);
  return (
    <div className="flex w-320 flex-col gap-6">
      <FieldLabel htmlFor={id}>Tags</FieldLabel>
      <TagInput id={id} value={tags} onChange={setTags} />
    </div>
  );
}
