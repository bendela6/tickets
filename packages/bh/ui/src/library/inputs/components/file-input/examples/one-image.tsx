import { useId, useState } from 'react';
import { FieldLabel, FileInput, type UploadFile } from '@bh/ui';

export function OneImage() {
  const id = useId();
  const [photo, setPhoto] = useState<UploadFile[]>([]);
  return (
    <div className="flex w-384 flex-col gap-4">
      <FieldLabel htmlFor={id}>Photo</FieldLabel>
      <FileInput
        id={id}
        label="Photo"
        accept="image/*"
        multiple={false}
        value={photo}
        onChange={setPhoto}
        onSelect={([file]) => {
          if (file) {
            setPhoto([{ id: crypto.randomUUID(), name: file.name, size: file.size }]);
          }
        }}
      />
    </div>
  );
}
