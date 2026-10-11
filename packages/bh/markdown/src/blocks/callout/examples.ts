import type { Example } from '../../registry';

const fence = (lines: string[]) => ['```callout', ...lines, '```'].join('\n');

/** Each level, and the two shapes of content: one line, and a markdown block. */
export const calloutExamples: Example[] = [
  {
    heading: 'A warning carrying markdown',
    note: 'The block scalar keeps the list and the code spans: `content` is parsed as markdown, not shown as text.',
    source: fence([
      'type: warning',
      'title: Fix it here, not in the copy',
      'content: |',
      '  An update **stops** on a copy edited in the app. Instead:',
      '',
      '  - make the fix in bh and push it to `main`',
      '  - update each app from the gateway once it is released',
    ]),
  },
  {
    heading: 'A single-line note',
    note: 'Content short enough to sit on the key needs no block scalar.',
    source: fence([
      'type: note',
      'title: Copies, not links',
      'content: An app builds from its own copy.',
    ]),
  },
  {
    heading: 'Important, for a limit worth stating once',
    source: fence([
      'type: important',
      'title: One storage key per app',
      'content: A package never names its own keys; the app passes them in.',
    ]),
  },
  {
    heading: 'A tip, for the better way',
    source: fence([
      'type: tip',
      'title: Tone before variant',
      'content: Pick `tone` for what the action means, then `variant` for how loud it is.',
    ]),
  },
  {
    heading: 'Caution, for an irreversible step',
    source: fence([
      'type: caution',
      'title: Forcing a sync discards edits',
      'content: "`--force` overwrites a copy edited in the app, edits and all."',
    ]),
  },
];
