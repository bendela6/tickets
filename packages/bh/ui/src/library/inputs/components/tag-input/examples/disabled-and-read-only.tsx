import { useId, useState } from 'react';
import { FieldLabel, TagInput } from '@bh/ui';

export function DisabledAndReadOnly() {
  const id = useId();
  const [tags, setTags] = useState<string[]>(['apple', 'pear']);
  return (
    <div className="flex w-320 flex-col gap-12">
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-disabled`}>Disabled</FieldLabel>
        <TagInput id={`${id}-disabled`} disabled value={tags} onChange={setTags} />
      </div>
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
        <TagInput id={`${id}-read-only`} readOnly value={tags} onChange={setTags} />
      </div>
    </div>
  );
}
