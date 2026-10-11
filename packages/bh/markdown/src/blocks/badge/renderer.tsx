import type { Renderer } from '../../registry';
import { TONE_NAMES } from '@bh/ui';
import { Badge, toneOf } from './badge';
import { badgeExamples } from './examples';

export const badgeBlock: Renderer<string> = {
  name: 'badge',
  group: 'Inline',
  body: 'text',
  inline: true,
  description:
    'A badge inside a sentence or a heading: `:badge[stable]{tone=success}`. The bracket text ' +
    'is the label. `tone` is a role (primary, success, warning, danger, neutral) or a scale ' +
    'by name, neutral when left out. In the markdown copy it is the label in bold.',
  attributes: {
    tone: { description: 'What the label means: a role, or a scale by name.', values: TONE_NAMES },
  },
  toMarkdown: (node) => `**${node.text ?? ''}**`,
  examples: badgeExamples,
  component: ({ data, attrs }) => <Badge label={data} tone={toneOf(attrs.tone)} />,
};
