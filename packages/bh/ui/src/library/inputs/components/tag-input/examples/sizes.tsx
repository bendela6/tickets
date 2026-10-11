import { useId, useState } from 'react';
import { FieldLabel, TagInput, type ControlSize } from '@bh/ui';

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const id = useId();
  const [tags, setTags] = useState<string[]>(['apple', 'pear']);
  return (
    <div className="flex w-320 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex items-center gap-12">
            <FieldLabel htmlFor={`${id}-${size}`} className="w-24">
              {size}
            </FieldLabel>
            <div className="flex-1">
              <TagInput id={`${id}-${size}`} size={size} value={tags} onChange={setTags} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
