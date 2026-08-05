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

/**
 * The kinds a FormConfig may name — the vocabulary anything GENERATING one has
 * to speak.
 *
 * This is the seam the table engine joins at. `propsToForm` picks a kind per
 * column and emits a FormConfig; the form layer resolves it through
 * `baseInputs` and never learns which control it ended up rendering. Derived
 * from the registry rather than restated, so a kind cannot be added to one
 * without the other.
 *
 * These strings are serialised into stored FormConfigs, so renaming one is a
 * data migration, not a refactor.
 */
export type InputKind = keyof typeof baseInputs;

/**
 * What a field of each kind holds — the other half of the contract, and the
 * half a type cannot infer from `defaultValue` alone (`null` is both an empty
 * number and an empty select).
 *
 * Nullability is meaning here, not style: a number field can be empty where a
 * toggle cannot, and a multi-select uses `[]` rather than null so "nothing
 * selected" has exactly one spelling.
 */
export type ValueOfKind = {
  text: string;
  textarea: string;
  number: number | null;
  select: string | null;
  'multi-select': string[];
  toggle: boolean;
  json: string;
};

/** Compile-time proof that the two stay in step: a kind added to `baseInputs`
 *  without a value type (or the reverse) fails here rather than at runtime. */
type KindsAgree = InputKind extends keyof ValueOfKind
  ? keyof ValueOfKind extends InputKind
    ? true
    : never
  : never;
const _kindsAgree: KindsAgree = true;
void _kindsAgree;

export const baseLayouts = {
  card: { Component: CardLayout },
  group: { Component: GroupLayout },
  row: { Component: RowLayout },
  column: { Component: ColumnLayout },
};
