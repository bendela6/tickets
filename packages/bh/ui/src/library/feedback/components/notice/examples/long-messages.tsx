import { Notice, Stack } from '@bh/ui';

// A message from a server, in its own words and on its own lines.
const PROBLEMS = [
  'Not saved until this fits the Article kind:',
  '• title is required',
  '• summary is longer than 280 characters',
].join('\n');

export function LongMessages() {
  return (
    <Stack gap={3}>
      <Notice tone="danger">{PROBLEMS}</Notice>
      <Notice tone="warning" title="The webhook did not answer">
        https://hooks.example.com/services/T0000000/B0000000/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      </Notice>
      <Notice tone="danger" title="Two rules do not parse">
        <ul className="font-mono">
          <li>line 4: /articles/[id is missing a ]</li>
          <li>line 9: the pattern matches nothing</li>
        </ul>
      </Notice>
    </Stack>
  );
}
