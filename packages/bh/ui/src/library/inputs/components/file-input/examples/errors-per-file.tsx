import { useId, useState } from 'react';
import { FieldLabel, FileInput, type UploadFile } from '@bh/ui';

export function ErrorsPerFile() {
  const id = useId();
  const [files, setFiles] = useState<UploadFile[]>([
    { id: '1', name: 'photo.png', size: 248_000 },
    { id: '2', name: 'notes.txt', size: 1_536 },
    { id: '3', name: 'archive.zip', error: 'Larger than 10 MB' },
  ]);
  return (
    <div className="flex w-384 flex-col gap-4">
      <FieldLabel htmlFor={id}>Attachments</FieldLabel>
      <FileInput id={id} value={files} onChange={setFiles} />
    </div>
  );
}
