import type { Renderer } from '../../registry';
import { keyboardExamples } from './examples';
import { Keyboard } from './keyboard';
import { keyboardSchema, type KeyboardData } from './schema';

/** A key table as plain markdown: each row's keys as code, `or` between them. */
function keyboardMarkdown(data: KeyboardData): string {
  const rows = data.map(({ keys, does }) => {
    const cell = keys.map((key) => `\`${key}\``).join(' or ');
    return `| ${cell} | ${does.replaceAll('|', '\\|')} |`;
  });
  return ['| Key | Does |', '|---|---|', ...rows].join('\n');
}

export const keyboardBlock: Renderer<KeyboardData> = {
  name: 'keyboard',
  group: 'Reference',
  body: 'data',
  description:
    'A key table: a list of rows, each with `keys` (any one of them does it) and `does`, a ' +
    'sentence. A chord is one key, its parts joined by `+`: `Ctrl+K`.',
  schema: keyboardSchema,
  toMarkdown: (node) => keyboardMarkdown(node.data as KeyboardData),
  examples: keyboardExamples,
  component: ({ data }) => <Keyboard data={data} />,
};
