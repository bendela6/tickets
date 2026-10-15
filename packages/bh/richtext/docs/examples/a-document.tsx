import { useState } from 'react';
import { RichTextEditor } from '@bh/richtext/editor';

const PLAN = `## Weekend in Porto

Pack **light**, and check [the forecast](https://example.com/weather) first.

- Book the train
- Find a café near the river

The tiles are blue and white, almost everywhere.`;

export function ADocument() {
  const [plan, setPlan] = useState(PLAN);
  return (
    <RichTextEditor
      label="Trip plan"
      features="full"
      value={plan}
      onChange={setPlan}
      placeholder="Write the plan…"
    />
  );
}
