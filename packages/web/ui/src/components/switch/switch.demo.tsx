import { boolean, definePlayground, text } from '../../gallery';
import { Switch } from './switch';

export const meta = { title: 'Switch', group: 'Components', size: 'sm' };

export const states = [
  { name: 'on', render: () => <Switch label="KPI strip" defaultChecked /> },
  { name: 'disabled', render: () => <Switch label="Disabled" disabled /> },
];

export const playground = definePlayground({
  controls: {
    label: text('KPI strip'),
    disabled: boolean(),
  },
  render: (v) => <Switch {...v} />,
});
