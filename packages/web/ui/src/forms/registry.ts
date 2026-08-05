import { CheckboxField } from './inputs/checkbox/checkbox-field';
import { DateField } from './inputs/date/date-field';
import { JsonField } from './inputs/json/json-field';
import { MultiSelectField } from './inputs/multi-select/multi-select-field';
import { NumberField } from './inputs/number/number-field';
import { RadioField } from './inputs/radio/radio-field';
import { SelectField } from './inputs/select/select-field';
import { SliderField } from './inputs/slider/slider-field';
import { TextField } from './inputs/text/text-field';
import { TextAreaField } from './inputs/textarea/textarea-field';
import { ToggleField } from './inputs/toggle/toggle-field';
import { CardLayout, ColumnLayout, GroupLayout, RowLayout } from './layouts';

/** The standard input set. Apps spread this and add their own — see
 *  apps/web/src/form/registry.tsx, which adds `directory`. Each defaultValue
 *  matches its adapter's value channel; a mismatch seeds the field wrong.
 *
 *  One kind per CONTROL, not per value type. `checkbox` and `toggle` both hold a
 *  boolean and `radio` and `select` both hold one string, but which of each pair
 *  a form uses is a real decision — a switch reads as taking effect on the spot,
 *  a checkbox as a value saved with the form; a radio group shows every option,
 *  a select hides them behind a trigger. That decision is what a stored config
 *  records, so it needs two names to record it with. */
export const baseInputs = {
  text: { Component: TextField, defaultValue: '' },
  textarea: { Component: TextAreaField, defaultValue: '' },
  number: { Component: NumberField, defaultValue: null },
  select: { Component: SelectField, defaultValue: null },
  'multi-select': { Component: MultiSelectField, defaultValue: [] as string[] },
  radio: { Component: RadioField, defaultValue: '' },
  toggle: { Component: ToggleField, defaultValue: false },
  checkbox: { Component: CheckboxField, defaultValue: false },
  date: { Component: DateField, defaultValue: null },
  slider: { Component: SliderField, defaultValue: 0 },
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
  /** `''` is "nothing chosen" — a radio group is never null, it is unselected. */
  radio: string;
  toggle: boolean;
  checkbox: boolean;
  /** ISO `yyyy-mm-dd`. A calendar day has no time and no zone; a `Date` has both. */
  date: string | null;
  /** Never null: a thumb is always somewhere, so an empty slider would render a
   *  position and lie about it. A number that can be empty is `number`. */
  slider: number;
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
