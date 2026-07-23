import { Switch } from './switch';

export const meta = { title: 'Switch', group: 'Form controls' };

export const states = [
  { name: 'on', render: () => <Switch label="KPI strip" defaultChecked /> },
  { name: 'disabled', render: () => <Switch label="Disabled" disabled /> },
];
