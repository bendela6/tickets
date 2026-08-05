import { JsonField } from './inputs/json/json-field';
import { MultiSelectField } from './inputs/multi-select/multi-select-field';
import { NumberField } from './inputs/number/number-field';
import { SelectField } from './inputs/select/select-field';
import { TextField } from './inputs/text/text-field';
import { TextAreaField } from './inputs/textarea/textarea-field';
import { ToggleField } from './inputs/toggle/toggle-field';
import { CardLayout, ColumnLayout, GroupLayout, RowLayout } from './layouts';

/** The standard input set. Apps spread this and add their own — see
 *  apps/web/src/form/registry.tsx, which adds `directory`. Each defaultValue
 *  matches its adapter's value channel; a mismatch seeds the field wrong. */
export const baseInputs = {
  text: { Component: TextField, defaultValue: '' },
  textarea: { Component: TextAreaField, defaultValue: '' },
  number: { Component: NumberField, defaultValue: null },
  select: { Component: SelectField, defaultValue: null },
  'multi-select': { Component: MultiSelectField, defaultValue: [] as string[] },
  toggle: { Component: ToggleField, defaultValue: false },
  json: { Component: JsonField, defaultValue: '' },
};

export const baseLayouts = {
  card: { Component: CardLayout },
  group: { Component: GroupLayout },
  row: { Component: RowLayout },
  column: { Component: ColumnLayout },
};
