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
