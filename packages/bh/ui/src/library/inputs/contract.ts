import type { SyntheticEvent } from 'react';
import type { Hue, Tone } from '../../style';
import type { IconName } from '../primitives/components/icon';
import type { Commit } from '@bh/form';

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
    radius: 'rounded-3',
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
    radius: 'rounded-4',
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
    radius: 'rounded-5',
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
 * One option vocabulary for every control that offers a choice.
 *
 * `color` is honoured by the controls that draw a swatch and ignored by the
 * ones with nowhere to paint one. `icon` reads the same way: drawn by the
 * controls with room for a glyph beside the label, ignored by the ones without.
 * So does `description`, drawn only where there is room for a line under the
 * label, which is RadioGroup and CheckboxGroup today. On the shared vocabulary
 * rather than a RadioGroup option of its own, because a second option type is
 * what this one replaced, and because a form's `radio` and `checkbox-group`
 * fields pass their options straight through: one type is what lets a stored
 * config carry the line too.
 */
export interface Option {
  /** What `onChange` reports when this option is picked. */
  value: string;
  /** What the option shows. */
  label: string;
  /** Shown, but neither the cursor nor a click can pick it. */
  disabled?: boolean;
  /**
   * Why a `disabled` option can't be chosen, e.g. "The workflow doesn't go
   * from Done to To do." The list controls (`Combobox`, with search or
   * without, and `MultiCombobox`) print it under the greyed row and make it
   * the row's description, so a screen reader reads it out; the others
   * ignore it.
   * Ignored on an option that isn't `disabled`.
   */
  disabledReason?: string;
  /** A scale for the controls that draw a swatch beside the label. */
  color?: Hue;
  /**
   * A glyph before the label, for the controls with room for one.
   *
   * A leading glyph, named from the registry rather than handed over as a node
   * — the same trade `Tabs` makes. A `ReactNode` would let any call site pass a
   * control a glyph it cannot size, tone, or hide from a screen reader.
   */
  icon?: IconName;
  /**
   * A line under the label, saying what choosing it does: drawn by RadioGroup
   * and CheckboxGroup, ignored by the controls with no room for it.
   *
   * Plain text, as `label` is, so an option stays data a stored config can hold.
   */
  description?: string;
}

/**
 * A heading in a list of options. `groupOf` names each option's `key`; the
 * groups' order is the order the list shows them in.
 */
export interface OptionGroup {
  /** What `groupOf` returns for the options under this heading. */
  key: string;
  /** The heading shown over them. */
  label: string;
}

// `Commit` (`'change' | 'leave' | { after: number }`) is the form engine's:
// a form sets it for its fields as the controls take it, so there is one
// definition, below both.
export type { Commit } from '@bh/form';

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
 *
 * A control holds no value of its own, with one exception: the text controls'
 * draft. Given `commit` other than `'change'` (`CommitProps`), `Input`,
 * `Textarea` and `NumberInput` hold what you type until the field commits, so
 * a caller that saves hears of an edit once rather than at every keystroke.
 * The draft lives only while you edit: `value` is what they show otherwise.
 */
export interface ControlProps<T> {
  /** The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page. */
  id?: string;
  /**
   * The ids of what describes the control: its help, or its problem. It lands
   * on the element `id` does. A form's field passes it, for the description
   * or error its wrapper draws.
   */
  'aria-describedby'?: string;
  /**
   * The value shown. The control holds none of its own: it reports changes through `onChange`.
   *
   * One exception: a text control (`CommitProps`) whose `commit` isn't
   * `'change'` holds what you type as a draft while you edit, and reports it
   * through `onChange` when it commits. It shows `value` again once the draft
   * commits or Escape drops it, and whenever nobody is typing in it.
   */
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
  /** The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels. */
  size?: ControlSize;
  /** The role or scale it is coloured from. */
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
  /** Added to the control's own classes. */
  className?: string;
}

/**
 * What the text controls (`Input`, `Textarea`, `NumberInput`, and through
 * `Input` `SearchInput` and `PasswordInput`) add to the contract: when what
 * you type is handed over.
 */
export interface CommitProps<T> {
  /**
   * When `onChange` gets what you typed: `'change'` at every keystroke;
   * `'leave'` on Enter and on leaving the field or the window; `{ after: 800 }`
   * on those and after 800 ms without typing.
   *
   * Until it commits, what you type is a draft the control holds: Escape puts
   * the value back, an unchanged draft commits nothing, and a `value` changed
   * from outside replaces the field while nobody is typing in it.
   */
  commit?: Commit;
  /**
   * What's in the field, at every keystroke, before it commits: for a count,
   * a preview, or a button that waits for some text. At `'change'` it's what
   * `onChange` gets.
   */
  onDraft?: (draft: T) => void;
}

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
