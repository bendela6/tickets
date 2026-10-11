import type { Example } from '../../registry';

const fence = (lines: string[]) => ['```keyboard', ...lines, '```'].join('\n');

/** One row with two keys, and the shapes a key takes: a name, an arrow, a chord. */
export const keyboardExamples: Example[] = [
  {
    heading: 'Two keys that do the same',
    note: 'Either key works, so both sit in one row.',
    source: fence(['- keys: [Enter, Space]', '  does: Activates the button.']),
  },
  {
    heading: 'Arrows, a chord and a key on its own',
    note: 'A chord is one key, its parts joined by `+`.',
    source: fence([
      '- keys: [↑, ↓]',
      '  does: Moves between the options.',
      '- keys: [Ctrl+K]',
      '  does: Opens search.',
      '- keys: [Esc]',
      '  does: Closes the list and keeps the value.',
    ]),
  },
];
