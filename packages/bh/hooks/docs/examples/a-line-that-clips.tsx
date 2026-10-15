import { useState } from 'react';
import { useIsClipped } from '@bh/hooks';

// The plain view useIsClipped drives: a box that clips its text, with no
// component of bh's. Its corner resizes it, as a column's edge would, and its
// `title` carries the whole text only while the box cuts it off.

const FIELD = 'rounded-8 border-gray-6 text-13/19 text-gray-12 border-1 px-12 py-6';

export function ALineThatClips() {
  const [text, setText] = useState('packages/web/hooks/src/use-is-clipped.ts');
  const { isClipped, ref } = useIsClipped(text);

  return (
    <div className="flex w-full flex-col items-start gap-12">
      <label className="text-12/17 text-gray-11 flex w-full max-w-400 flex-col gap-4">
        Its text
        <input className={FIELD} value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <p
        ref={ref}
        title={isClipped ? text : undefined}
        className={`${FIELD} w-240 max-w-full min-w-64 resize-x overflow-hidden whitespace-nowrap`}
      >
        {text}
      </p>
      <p className="text-12/17 text-gray-11">
        {isClipped ? 'Clipped: hover the box for the rest.' : 'It fits.'}
      </p>
    </div>
  );
}
