import { Checkbox } from './checkbox';

export const meta = { title: 'Checkbox', group: 'Form controls' };

export const states = [
  { name: 'off', render: () => <Checkbox label="Off" /> },
  { name: 'on', render: () => <Checkbox label="On" defaultChecked /> },
  { name: 'mixed', render: () => <Checkbox label="Mixed" indeterminate /> },
  { name: 'disabled', render: () => <Checkbox label="Disabled" disabled /> },
];
