import { useId, useState } from 'react';
import { FieldLabel, FileInput, type UploadFile } from '@bh/ui';

export function ChoosingFiles() {
  const id = useId();
  const [files, setFiles] = useState<UploadFile[]>([]);
  return (
    <div className="flex w-384 flex-col gap-4">
      <FieldLabel htmlFor={id}>Attachments</FieldLabel>
      <FileInput
        id={id}
        value={files}
        onChange={setFiles}
        onSelect={(chosen) => {
          setFiles((current) => {
            return [
              ...current,
              ...chosen.map((file) => {
                return { id: crypto.randomUUID(), name: file.name, size: file.size };
              }),
            ];
          });
        }}
      />
    </div>
  );
}
