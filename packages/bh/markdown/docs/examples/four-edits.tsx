import { useState } from 'react';
import { CodeBlock, editPage, type PageEdit } from '@bh/markdown';
import { SegmentedControl } from '@bh/ui';

const PAGE = `title: Reading list
summary: The books on the shelf by the window.
body:
  - |
    Five books, in the order they were bought.
  # Novels first, then the rest.
  - h2: Novels
  - |
    Middlemarch, Kindred and Possession.
  - callout:
      type: note
      title: On loan
      content: Kindred is with Nino until May.
  - h2: Poetry
  - |
    Two collections by Szymborska.
`;

// Each edit names an item by its place in body, from 0.
const EDITS: PageEdit[] = [
  {
    op: 'set',
    index: 3,
    item: { callout: { type: 'tip', title: 'On loan', content: 'Kindred is back on the shelf.' } },
  },
  { op: 'insert', index: 6, item: 'Read aloud on Sundays.' },
  { op: 'move', from: 3, to: 2 },
  { op: 'meta', key: 'related', value: ['Wish list'] },
];

const VIEWS = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
];

export function FourEdits() {
  const [view, setView] = useState('after');
  const yaml = view === 'before' ? PAGE : editPage(PAGE, EDITS);
  return (
    <div className="flex w-full max-w-560 flex-col gap-12">
      <SegmentedControl label="Page" options={VIEWS} value={view} onChange={setView} />
      <CodeBlock lang="yaml" value={yaml} />
    </div>
  );
}
