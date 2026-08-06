import type { SyntheticEvent } from 'react';
import type { Hue, Tone } from '../../../style';

/**
 * The one size domain for every form control — 30 / 38 / 46px.
 *
 * `xs` replaced `sm` in the Soft Fill redesign (2026-08-05): the bottom rung
 * both shrank and was renamed, because a dense table cell and a filter bar
 * needed something below the old 28px `sm` and the design settled the ladder at
 * 30 / 38 / 46. Renaming rather than adding was deliberate — three rungs is the
 * whole domain, and a fourth would have been chosen at random by every caller.
 */
export type ControlSize = 'xs' | 'md' | 'lg';

/**
 * The ladder, as data, so no control invents its own rung.
 *
 * One set of ratios in 8px steps — the design states it once and every control
 * reads it. Previously each control carried a private `Record<ControlSize,
 * string>`, which is how three of them ended up with different padding at the
 * same height.
 *
 * Classes are written out rather than interpolated so Tailwind's scanner finds
 * them; nothing here needs the safelist.
 */
export const CONTROL_LADDER = {
  xs: {
    height: 'h-30',
    radius: 'rounded-control-xs',
    text: 'text-12',
    padX: 'px-9',
    /** Checkbox / radio / switch-thumb box. */
    mark: 'size-14',
    /** Leading and trailing glyphs, in px — icons take a number, not a class. */
    icon: 12,
    /** A removable chip inside a multi-value trigger. */
    chip: 'h-20',
    gap: 'gap-6',
    label: 'text-11',
    help: 'text-11',
  },
  md: {
    height: 'h-38',
    radius: 'rounded-control-md',
    text: 'text-13',
    padX: 'px-12',
    mark: 'size-16',
    icon: 14,
    chip: 'h-24',
    gap: 'gap-8',
    label: 'text-12',
    help: 'text-12',
  },
  lg: {
    height: 'h-46',
    radius: 'rounded-control-lg',
    text: 'text-14',
    padX: 'px-14',
    mark: 'size-20',
    icon: 16,
    chip: 'h-28',
    gap: 'gap-9',
    label: 'text-13',
    help: 'text-12',
  },
} as const satisfies Record<ControlSize, Record<string, string | number>>;

/**
 * One option vocabulary for every control that offers a choice, replacing the
 * near-identical `Option` and `RadioOption`.
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
  /**
   * The new value — and, second, the event that produced it where one exists.
   *
   * The value is the contract: a generic driver passes only that, and every
   * ordinary call site writes `onChange={setFoo}` and never sees the second
   * argument. It exists because a handful of call sites legitimately need the
   * modifier keys, and without it they cannot be written at all.
   *
   * The case that forced it is the table's own select cell, which reads
   * `shiftKey` off the native event to extend a row range. Under a strict
   * one-argument signature that feature does not fail to compile — it silently
   * stops working, which is the worst way for it to go.
   */
  onChange: (value: T, event?: SyntheticEvent) => void;
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
/**
 * Not applicable to you — one definition, three spellings.
 *
 * The design: "floor rung 5 at 45% opacity — chrome and value fade together".
 * One opacity, no second palette to maintain, and it applies to a mark or a
 * swatch as readily as to a field, which is why it replaced the 45° hatch.
 *
 * It lives here beside the read-only treatments because it was previously
 * written out at FIFTEEN call sites with THREE different answers: `fieldClass`
 * said 45%, nine triggers said 50% inline (and won, being merged later), and
 * the marks still tinted a ground and drew a border — the pre-Soft-Fill
 * treatment, which never went through `fieldClass` and so never got migrated.
 * Read-only has never had that problem, because it has always been a constant.
 *
 * Spelled out literally rather than built from a list: Tailwind's scanner reads
 * source text, so an interpolated `disabled:${c}` would compile to nothing.
 */
const DISABLED_VISUAL = 'opacity-45 text-gray-9 cursor-default pointer-events-none';

/** For a control that applies it conditionally in TS rather than by variant. */
export const disabledTreatment = DISABLED_VISUAL;

/** For an element carrying the real `disabled` attribute. */
export const disabledClass =
  'disabled:opacity-45 disabled:text-gray-9 disabled:cursor-default disabled:pointer-events-none';

/** For a role-based control that can only say `aria-disabled` — a slider div,
 *  a rating group. HTML's attribute does not reach those roles. */
export const disabledAriaClass =
  'aria-disabled:opacity-45 aria-disabled:text-gray-9 aria-disabled:cursor-default aria-disabled:pointer-events-none';

export const readOnlyFieldClass =
  // Soft Fill's read-only is the absence of the floor, not a different floor.
  // Every other state fills; this one does not, and shows a single rung-7 rule
  // instead — which is why it cannot be mistaken for disabled (a hatch) or for
  // rest (a fill). The value stays rung 12 at full contrast because reading it
  // is the entire point.
  // A PRINTED ROW, not a quieter box. `22 Disabled ReadOnly and Tones` records
  // six candidates and picks F for this: the slot goes away entirely and the
  // value is printed over a rule. The rejected alternative it names is exactly
  // the trap a bordered version falls into — "read-only still has a floor, so
  // it looks editable and invites a click that does nothing. A glyph cannot fix
  // an affordance you left in place."
  //
  // So: no floor, no radius, no box — one hairline under the value, and the
  // padding collapses to 2px because there is no longer a field to inset from.
  //
  // Every interactive channel is cancelled, not just the floor. When hover
  // gained a RIM as well as a fill (2026-08-06), cancelling only `hover:bg-*`
  // left a read-only field lighting its border under the pointer — a control
  // answering a gesture it will not honour.
  [
    'bg-transparent hover:bg-transparent active:bg-transparent',
    'border-transparent border-b-gray-7',
    'hover:border-transparent hover:border-b-gray-7',
    'active:border-transparent active:border-b-gray-7',
    'rounded-none px-2',
    'text-gray-12 cursor-default',
  ].join(' ');

/**
 * The same idea for the mark-based controls — checkbox, switch, radio, slider.
 *
 * No ground to tint, so the signal is the loss of the affordance: the cursor
 * stops inviting a click and the hover response goes. The mark keeps its tone,
 * because the whole point of read-only is that the value stays readable.
 */
export const readOnlyMarkClass = 'cursor-default pointer-events-none';
