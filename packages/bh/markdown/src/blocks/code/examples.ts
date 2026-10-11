import type { Example } from '../../registry';

const fence = (info: string, lines: string[]) => ['```code' + info, ...lines, '```'].join('\n');

/** Bare, named, marked, unnumbered, and one wide enough to scroll. */
export const codeExamples: Example[] = [
  {
    heading: 'A fragment with nothing but code',
    note: 'No attributes at all: numbered lines and a copy control.',
    source: fence('', ["const theme = readStoredTheme('my-app-theme');", 'applyTheme(theme);']),
  },
  {
    heading: 'A named file, coloured by its language',
    note: '`file` names the strip and `lang` picks the grammar.',
    source: fence('{lang=tsx file=src/app/save.tsx}', [
      "import { Button } from '@bh/ui';",
      '',
      'export function Save({ saving }: { saving: boolean }) {',
      '  return <Button loading={saving}>Save</Button>;',
      '}',
    ]),
  },
  {
    heading: 'The lines the passage is about',
    note: '`lines` marks them (a single line, a range, or both) and everything else recedes.',
    source: fence('{lang=tsx file=src/app/save.tsx lines=4}', [
      "import { Button } from '@bh/ui';",
      '',
      'export function Save({ saving }: { saving: boolean }) {',
      '  return <Button loading={saving}>Save</Button>;',
      '}',
    ]),
  },
  {
    heading: 'Two lines of shell, unnumbered',
    note: 'For a command or two the gutter is noise: `numbers=false` drops it.',
    source: fence('{lang=sh numbers=false}', ['pnpm install', 'pnpm test']),
  },
  {
    heading: 'Wider than the space it is given',
    note: 'A long line scrolls inside the frame rather than wrapping.',
    source: fence('{lang=json}', [
      '{ "packages": ["ui", "table", "form", "markdown", "config"], "note": "an update names any package one of them needs" }',
    ]),
  },
];
