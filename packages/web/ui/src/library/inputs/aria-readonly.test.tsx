import { render } from '@testing-library/react';
import axe from 'axe-core';
import { expect, test } from 'vitest';
import { Combobox } from './components/combobox';
import { MultiCombobox } from './components/multi-combobox';
import { DatePicker } from './components/date-picker';
import { Checkbox } from './components/checkbox';
import { Switch } from './components/switch';
import { Slider } from './components/slider';
import { RadioGroup } from './components/radio-group';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

/**
 * `readOnly` is expressed as `aria-readonly` on the six controls whose element
 * does not honour HTML's `readonly`. ARIA only permits that attribute on
 * certain roles — checkbox, combobox, listbox, radiogroup, slider, spinbutton,
 * textbox and friends — and a plain `button` is NOT among them.
 *
 * Three of these controls are popover triggers rendered as `<button>`, so this
 * asks axe rather than asking me. `aria-allowed-attr` is the rule that fires.
 */
const CASES: [string, React.ReactElement][] = [
  ['Combobox', <Combobox options={OPTIONS} value="a" onChange={() => {}} readOnly />],
  ['MultiCombobox', <MultiCombobox options={OPTIONS} value={['a']} onChange={() => {}} readOnly />],
  ['DatePicker', <DatePicker value="2026-08-05" onChange={() => {}} readOnly />],
  ['Checkbox', <Checkbox label="Ship it" value onChange={() => {}} readOnly />],
  ['Switch', <Switch label="Ship it" value onChange={() => {}} readOnly />],
  ['Slider', <Slider label="Weight" value={40} onChange={() => {}} readOnly />],
  [
    'RadioGroup',
    <RadioGroup label="Kind" value="a" options={OPTIONS} onChange={() => {}} readOnly />,
  ],
];

test.each(CASES)('%s announces read-only with an attribute its role permits', async (_name, el) => {
  const { container } = render(el);
  const results = await axe.run(container, {
    runOnly: { type: 'rule', values: ['aria-allowed-attr', 'aria-allowed-role'] },
  });
  const detail = results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.html}`));
  expect(detail).toEqual([]);
});
