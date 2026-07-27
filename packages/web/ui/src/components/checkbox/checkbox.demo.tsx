import { boolean, definePlayground, text } from '../../gallery';
import { Checkbox } from './checkbox';

export const meta = { title: 'Checkbox', group: 'Form controls', size: 'sm' };

export const states = [
  { name: 'off', render: () => <Checkbox label="Off" /> },
  { name: 'on', render: () => <Checkbox label="On" defaultChecked /> },
  { name: 'mixed', render: () => <Checkbox label="Mixed" indeterminate /> },
  { name: 'disabled', render: () => <Checkbox label="Disabled" disabled /> },
];

export const playground = definePlayground({
  controls: {
    label: text('Notify me'),
    indeterminate: boolean(),
    disabled: boolean(),
  },
  render: (v) => <Checkbox {...v} />,
});
