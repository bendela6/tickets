import { useId, useState } from 'react';
import { FieldLabel, TagInput, type Option } from '@bh/ui';

const COLOURS: Option[] = [
  { value: 'red', label: 'red' },
  { value: 'green', label: 'green' },
  { value: 'blue', label: 'blue' },
  { value: 'yellow', label: 'yellow' },
];

export function WithSuggestions() {
  const id = useId();
  const [tags, setTags] = useState<string[]>(['red']);
  return (
    <div className="flex w-320 flex-col gap-6">
      <FieldLabel htmlFor={id}>Colours</FieldLabel>
      <TagInput id={id} suggestions={COLOURS} value={tags} onChange={setTags} />
    </div>
  );
}
