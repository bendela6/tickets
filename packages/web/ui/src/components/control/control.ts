import type { Hue, Tone } from '../../style';

/**
 * The one size domain for every form control — 28 / 36 / 44px.
 *
 * Replaces the three names this used to have — one per module that happened to
 * need it — two of them character-for-character identical unions and the third
 * missing its top rung for no stated reason.
 *
 * Height is what the rung fixes. Font size and padding stay per-control — the
 * spec puts a 36px input at 14px and a 36px select at 13px, and folding those
 * together here would change appearance under cover of a refactor.
 */
export type ControlSize = 'sm' | 'md' | 'lg';

/**
 * One option vocabulary for every control that offers a choice, replacing the
 * near-identical `ComboOption` and `RadioOption`.
 *
 * `color` is honoured by the controls that draw a swatch; `SelectRadio` ignores
 * it, having nowhere to paint one.
 */
export type Option = {
  value: string;
  label: string;
  disabled?: boolean;
  color?: Hue;
};

/**
 * What every control in this package answers to. A caller that knows the value
 * kind can drive any of them without knowing which it holds — which is the
 * whole reason the table engine can emit one FormConfig per column.
 *
 * `tone` unset is NOT a synonym for `'primary'`. It is the resting state: a
 * bordered field left alone draws a neutral border and only takes colour when a
 * tone is named. The mark-based controls (the toggles, the slider) default to
 * `'primary'` instead, because a mark is always painted from some ramp and
 * there is no neutral checkbox.
 *
 * There is deliberately no `invalid`. Error is a tone like any other, resolved
 * one layer up where both facts are known: `tone={error ? 'danger' : config.tone}`.
 */
export type ControlProps<T> = {
  id?: string;
  value: T;
  onChange: (value: T) => void;
  size?: ControlSize;
  tone?: Tone;
  /** Not applicable: removed from the tab order and from form submission. */
  disabled?: boolean;
  /**
   * Not editable, but still focusable and still submitted.
   *
   * Honoured two ways, and the split follows the platform rather than the
   * concept: the text-entry controls take HTML's `readonly`, while the toggles,
   * the selects, the radio group and the slider set `aria-readonly` and refuse
   * to emit `onChange`. HTML's attribute does not reach checkbox, radio or
   * range — which is exactly why ARIA defines `aria-readonly` for those roles.
   *
   * Reaching for `disabled` instead would be wrong twice over: it drops the tab
   * stop, and it drops the value from submission, which a field locked by
   * permission still owes.
   */
  readOnly?: boolean;
  className?: string;
};

/**
 * The rest treatment for a read-only bordered field.
 *
 * Deliberately NOT the disabled look. Disabled says "not for you" and dims the
 * text to `gray-9`; read-only says "not editable here" about a value that still
 * matters, so the text keeps full contrast and only the ground and the
 * affordances change. The border drops to the resting rung and stops answering
 * to hover, because there is nothing to hover toward.
 *
 * Composed in TypeScript rather than as a `read-only:` variant on purpose:
 * that variant compiles to the CSS `:read-only` pseudo-class, which matches
 * every element that is not user-editable — including the wrapper `div`s
 * `fieldClass` is applied to on NumberInput and an adorned Input. It would be
 * permanently on there.
 */
export const readOnlyFieldClass = 'border-gray-6 bg-surface-inset hover:border-gray-6 cursor-default';

/**
 * The same idea for the mark-based controls — checkbox, switch, radio, slider.
 *
 * No ground to tint, so the signal is the loss of the affordance: the cursor
 * stops inviting a click and the hover response goes. The mark keeps its tone,
 * because the whole point of read-only is that the value stays readable.
 */
export const readOnlyMarkClass = 'cursor-default pointer-events-none';
