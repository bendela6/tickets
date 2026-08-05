import { useState } from 'react';
import { defineState, Slot } from '../../../gallery';
import { FileInput, type UploadFile } from './file-input';

export const meta = { title: 'FileInput', group: 'Inputs', size: 'md' };

/*
 * A drop target that is ALSO a button — both, not either. Dropping is faster
 * when the file is already in a window; browsing is the only route for anyone
 * not using a pointer.
 *
 * Uploading belongs to the caller: it owns the endpoint, the retries and the
 * abort. This control reports what was picked and renders the state it is
 * handed back, rather than pretending to own a transfer it cannot see.
 */

const SETTLED: UploadFile[] = [
  { id: '1', name: 'board-redesign.png', size: 248_000 },
  { id: '2', name: 'trace-2026-08-05.log', size: 1_536 },
];

const IN_FLIGHT: UploadFile[] = [
  { id: '1', name: 'board-redesign.png', size: 248_000 },
  { id: '2', name: 'capture.mp4', progress: 62 },
  { id: '3', name: 'archive.zip', error: 'Larger than 10 MB' },
];

function Live({ initial = [] as UploadFile[], ...props }: { initial?: UploadFile[] } & Record<string, unknown>) {
  const [value, setValue] = useState<UploadFile[]>(initial);
  return (
    <div className="w-384">
      <FileInput
        value={value}
        onChange={setValue}
        onSelect={(files) =>
          setValue((current) => [
            ...current,
            ...files.map((file, index) => ({
              id: `${Date.now()}-${index}`,
              name: file.name,
              size: file.size,
            })),
          ])
        }
        {...props}
      />
    </div>
  );
}

export const states = [
  defineState({
    title: 'empty — drop, or browse',
    render: () => (
      <Slot label="drag a file over it; the whole target answers, not just its edge">
        <Live />
      </Slot>
    ),
  }),

  defineState({
    title: 'chosen, with sizes',
    render: () => <Live initial={SETTLED} />,
  }),

  defineState({
    // An error belongs to its FILE. One rejected upload must not condemn the
    // two beside it that were fine.
    title: 'in flight, and one rejected',
    render: () => <Live initial={IN_FLIGHT} />,
  }),

  defineState({
    title: 'read-only keeps the list and drops the removals',
    render: () => (
      <div className="flex flex-col gap-16">
        <Live initial={SETTLED} readOnly />
        <Live initial={SETTLED} disabled />
      </div>
    ),
  }),
];
