import type { UploadFile } from '../inputs/components/file-input';
import { CheckboxField } from './bindings/checkbox/checkbox-field';
import { CheckboxGroupField } from './bindings/checkbox-group/checkbox-group-field';
import { ColorField } from './bindings/color/color-field';
import { DateField } from './bindings/date/date-field';
import { DateRangeField } from './bindings/date-range/date-range-field';
import { DurationField } from './bindings/duration/duration-field';
import { FileField } from './bindings/file/file-field';
import { IconField } from './bindings/icon/icon-field';
import { PasswordField } from './bindings/password/password-field';
import { PinField } from './bindings/pin/pin-field';
import { RangeField } from './bindings/range-slider/range-slider-field';
import { RatingField } from './bindings/rating/rating-field';
import { SegmentedField } from './bindings/segmented/segmented-field';
import { TagsField } from './bindings/tags/tags-field';
import { TimeField } from './bindings/time/time-field';
import { UserField } from './bindings/user/user-field';
import { JsonField } from './bindings/json/json-field';
import { MultiSelectField } from './bindings/multi-select/multi-select-field';
import { NumberField } from './bindings/number/number-field';
import { RadioField } from './bindings/radio/radio-field';
import { SelectField } from './bindings/select/select-field';
import { SliderField } from './bindings/slider/slider-field';
import { TextField } from './bindings/text/text-field';
import { TextAreaField } from './bindings/textarea/textarea-field';
import { ToggleField } from './bindings/toggle/toggle-field';
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

  // The sixteen from the Soft Fill design. `search` is the one control that got
  // no kind: it filters a view rather than holding a value, so a form has
  // nothing to store for it.
  password: { Component: PasswordField, defaultValue: '' },
  pin: { Component: PinField, defaultValue: '' },
  segmented: { Component: SegmentedField, defaultValue: '' },
  'checkbox-group': { Component: CheckboxGroupField, defaultValue: [] as string[] },
  tags: { Component: TagsField, defaultValue: [] as string[] },
  rating: { Component: RatingField, defaultValue: 0 },
  range: { Component: RangeField, defaultValue: [0, 100] as [number, number] },
  'date-range': { Component: DateRangeField, defaultValue: [null, null] as [string | null, string | null] },
  time: { Component: TimeField, defaultValue: null },
  duration: { Component: DurationField, defaultValue: null },
  color: { Component: ColorField, defaultValue: null },
  icon: { Component: IconField, defaultValue: null },
  user: { Component: UserField, defaultValue: [] as string[] },
  file: { Component: FileField, defaultValue: [] as UploadFile[] },
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

  password: string;
  /** The whole code, not one value per cell. */
  pin: string;
  segmented: string;
  'checkbox-group': string[];
  /** Free text, so these are the values themselves rather than ids into a list. */
  tags: string[];
  /** 0 is unrated — a real answer, which is why this is not nullable. */
  rating: number;
  /** Two thumbs are always somewhere, so a range is never null. */
  range: [number, number];
  /** Either half may be null: a half-picked range is a real state to hold. */
  'date-range': [string | null, string | null];
  /** `HH:MM`, a clock reading. */
  time: string | null;
  /** MINUTES, a length. Looks like `time` and means something else entirely. */
  duration: number | null;
  /** A hue name from the eleven ramps. */
  color: string | null;
  /** An icon name from the registry. */
  icon: string | null;
  /** Person ids, in both single and multi mode. */
  user: string[];
  file: UploadFile[];
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
