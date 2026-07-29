import { JsonInput } from './inputs/json/json-input';
import { MultiSelectInput } from './inputs/multi-select/multi-select-input';
import { NumberFormInput } from './inputs/number/number-input';
import { SelectInput } from './inputs/select/select-input';
import { TextInput } from './inputs/text/text-input';
import { TextareaInput } from './inputs/textarea/textarea-input';
import { ToggleInput } from './inputs/toggle/toggle-input';
import { CardLayout, ColumnLayout, GroupLayout, RowLayout } from './layouts';

/** The standard input set. Apps spread this and add their own — see
 *  apps/web/src/form/registry.tsx, which adds `directory`. Each defaultValue
 *  matches its adapter's value channel; a mismatch seeds the field wrong. */
export const baseInputs = {
  text: { Component: TextInput, defaultValue: '' },
  textarea: { Component: TextareaInput, defaultValue: '' },
  number: { Component: NumberFormInput, defaultValue: null },
  select: { Component: SelectInput, defaultValue: null },
  'multi-select': { Component: MultiSelectInput, defaultValue: [] as string[] },
  toggle: { Component: ToggleInput, defaultValue: false },
  json: { Component: JsonInput, defaultValue: '' },
};

export const baseLayouts = {
  card: { Component: CardLayout },
  group: { Component: GroupLayout },
  row: { Component: RowLayout },
  column: { Component: ColumnLayout },
};
