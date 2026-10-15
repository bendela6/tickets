import { useState } from 'react';
import { Button, Notice, Stack } from '@bh/ui';

type Outcome = 'none' | 'failed' | 'saved';

export function AfterAnAction() {
  const [outcome, setOutcome] = useState<Outcome>('none');
  return (
    <Stack gap={3} align="start" className="w-full max-w-480">
      <Button
        variant="solid"
        onClick={() => {
          // The first save fails and the next one works, so both notices show.
          setOutcome((last) => (last === 'failed' ? 'saved' : 'failed'));
        }}
      >
        Save
      </Button>
      {outcome === 'failed' ? (
        <Notice tone="danger" announce className="self-stretch">
          The save failed: the page changed on disk since you opened it.
        </Notice>
      ) : null}
      {outcome === 'saved' ? (
        <Notice tone="success" announce className="self-stretch">
          Saved. The page is live at /notes/today.
        </Notice>
      ) : null}
    </Stack>
  );
}
