import { useState } from 'react';
import { TextLink } from '@bh/ui';

const FILES = ['report.pdf', 'summary.csv', 'chart.png'];

export function AButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-12/17 text-gray-11 flex flex-col gap-6">
      <p>
        Exported {FILES.length} files ·{' '}
        <TextLink asChild>
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide them' : 'Show them'}
          </button>
        </TextLink>
      </p>
      {open ? (
        <ul className="text-gray-12 font-mono">
          {FILES.map((file) => {
            return <li key={file}>{file}</li>;
          })}
        </ul>
      ) : null}
    </div>
  );
}
