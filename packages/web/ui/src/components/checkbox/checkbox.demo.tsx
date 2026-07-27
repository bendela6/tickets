import { boolean, definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { Checkbox } from './checkbox';

export const meta = { title: 'Checkbox', group: 'Components', size: 'sm' };

export const states = [
  { name: 'off', render: () => <Checkbox label="Off" /> },
  { name: 'on', render: () => <Checkbox label="On" defaultChecked /> },
  { name: 'mixed', render: () => <Checkbox label="Mixed" indeterminate /> },
  { name: 'disabled', render: () => <Checkbox label="Disabled" disabled /> },
];

export const playground = definePlayground({
  controls: {
    size: select(['sm', 'md', 'lg'] as const, { initial: 'md', type: 'ToggleSize' }),
    tone: select([...TONE_NAMES], { allowNone: true, type: 'Tone' }),
    label: text('Notify me'),
    indeterminate: boolean(),
    disabled: boolean(),
  },
  render: (v) => <Checkbox {...v} />,
});
