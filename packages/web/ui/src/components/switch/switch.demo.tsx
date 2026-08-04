import { boolean, definePlayground, select, text } from '../../gallery';
import { TONE_NAMES } from '../../style';
import { Switch } from './switch';
import type { ControlSize } from '../control';

export const meta = { title: 'Switch', group: 'Components', size: 'sm' };

export const states = [
  { name: 'on', render: () => <Switch label="KPI strip" defaultChecked /> },
  { name: 'disabled', render: () => <Switch label="Disabled" disabled /> },
];

export const playground = definePlayground({
  controls: {
    size: select(['sm', 'md', 'lg'] as const, { initial: 'md', type: 'ControlSize' }),
    tone: select([...TONE_NAMES], { allowNone: true, type: 'Tone' }),
    label: text('KPI strip'),
    disabled: boolean(),
  },
  render: (v) => <Switch {...v} />,
});
