import { useState } from 'react';
import { Button, Progress } from '@bh/ui';

const PAGES = 880;

export function PagesRead() {
  const [read, setRead] = useState(320);
  const percent = Math.round((read / PAGES) * 100);
  return (
    <div className="flex w-full max-w-320 flex-col gap-12">
      <p className="text-13/20 text-gray-11">
        Middlemarch: {read} of {PAGES} pages
      </p>
      <Progress value={percent} trailing={`${percent}%`} aria-label="Pages read" />
      <div className="flex gap-8">
        <Button onClick={() => setRead(Math.min(PAGES, read + 40))}>Read 40 more</Button>
        <Button variant="ghost" tone="neutral" onClick={() => setRead(0)}>
          Start again
        </Button>
      </div>
    </div>
  );
}
