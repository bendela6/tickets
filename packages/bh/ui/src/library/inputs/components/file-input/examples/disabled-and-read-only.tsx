import { useId, useState } from 'react';
import { FieldLabel, FileInput, type UploadFile } from '@bh/ui';

export function DisabledAndReadOnly() {
  const id = useId();
  const [drafts, setDrafts] = useState<UploadFile[]>([{ id: '1', name: 'draft.pdf', size: 1_536 }]);
  const [signed, setSigned] = useState<UploadFile[]>([
    { id: '2', name: 'signed.pdf', size: 2_048 },
  ]);
  return (
    <div className="flex w-384 flex-col gap-16">
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-drafts`}>Drafts</FieldLabel>
        <FileInput
          id={`${id}-drafts`}
          label="Drafts"
          disabled
          value={drafts}
          onChange={setDrafts}
        />
      </div>
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-signed`}>Signed copies</FieldLabel>
        <FileInput
          id={`${id}-signed`}
          label="Signed copies"
          readOnly
          value={signed}
          onChange={setSigned}
        />
      </div>
    </div>
  );
}
