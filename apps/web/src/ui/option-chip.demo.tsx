import { definePlayground, select, text } from '@tickets/ui/gallery';
import { OptionChip, type OptionColor } from './option-chip';

const OPTION_COLORS: OptionColor[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'purple',
  'pink',
  'gray',
];

export const meta = { title: 'Option Chip', group: 'Display', order: 2 };

export const states = OPTION_COLORS.map((color) => ({
  name: color,
  render: () => <OptionChip color={color} label={color} />,
}));

export const playground = definePlayground({
  controls: {
    color: select(OPTION_COLORS, { initial: OPTION_COLORS[0] }),
    label: text('frontend'),
  },
  render: ({ color, label }) => <OptionChip color={color} label={label} />,
});
