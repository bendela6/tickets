import { useState } from 'react';
import { Card, CardBody, CardHeader, CardState, CardTitle, SegmentedControl } from '@bh/ui';

const STATES = [
  { value: 'loading', label: 'Loading' },
  { value: 'error', label: 'Error' },
  { value: 'empty', label: 'Empty' },
  { value: 'answer', label: 'Answer' },
];

export function ItsFourStates() {
  const [state, setState] = useState('answer');
  return (
    <div className="flex w-320 flex-col gap-12">
      <SegmentedControl label="State" options={STATES} value={state} onChange={setState} />
      <Card>
        <CardHeader>
          <CardTitle>Uploads</CardTitle>
        </CardHeader>
        <CardBody>
          <CardState
            isLoading={state === 'loading'}
            error={state === 'error' ? new Error('The server did not answer in 5 s.') : null}
            isEmpty={state === 'empty'}
            emptyText="Nothing is uploading"
          >
            <p className="text-13/19 text-gray-11">3 files uploading, 12 MB left.</p>
            <p className="text-13/19 text-gray-11">
              The content sits in a column, 16 pixels apart.
            </p>
          </CardState>
        </CardBody>
      </Card>
    </div>
  );
}
