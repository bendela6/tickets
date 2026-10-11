import { useId } from 'react';
import { axis, cn, HUES, over, TONE_HUE, variants } from '../../../../style';
import { toggleGlyphClass, toggleMarkClass, toggleRowClass } from '../../parts/toggle';
import {
  CONTROL_LADDER,
  readOnlyMarkClass,
  type ControlProps,
  type ControlSize,
  type Option,
} from '../../contract';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

/**
 * How the choices are presented.
 *
 * `plain` is a row of marks and labels — right when the options are one word
 * each and the group sits inline. `card` gives each option its own bordered
 * hit area that lights up when selected, which is what you want when the
 * options need room, sit in a settings pane, or are being tapped.
 */
export type RadioGroupVariant = 'plain' | 'card';

/**
 * `ControlProps<string>` and not `<string | null>`: a radio group HAS a
 * selection. That is the whole difference between it and a Combobox, which
 * holds the same value kind and can be empty — there is no radio you can click
 * to arrive at "nothing chosen".
 */
type RadioGroupProps = ControlProps<string> & {
  /**
   * The group's name, rendered as its `<legend>`, which only screen readers
   * read.
   *
   * Required. The toggles can be named from the outside by a `<label for>`; a `<fieldset>`
   * cannot — `for` points at a form control, and a fieldset is not one. So the
   * name has to come through the component, and the component renders it as the
   * `<legend>`.
   */
  label: string;
  /** The choices, a radio each, in the order given; a `disabled` option can't be chosen. */
  options: Option[];
  /**
   * How the options are drawn: `plain`, a mark and a label each, or `card`,
   * each a bordered hit area that lights up when chosen.
   */
  variant?: RadioGroupVariant;
  /**
   * The radios' `name`, generated when left out; pass one for a submitted
   * form whose server expects a particular key.
   *
   * What the radios are grouped under in the DOM. Optional, and generated when
   * absent: grouping is this component's own bookkeeping, and demanding a
   * unique string for it made every caller solve a problem that only exists
   * inside here. Pass one when the group is inside a real submitted form and
   * the server expects a particular key.
   */
  name?: string;
};

/** Whether this option is the selected one. */
const CHECKED = axis('state', ['on', 'off'], 'off');

// `card` turns the whole label into the hit area, so its selected state has to
// read on the container rather than only on the 16px mark.
const optionClass = variants({
  base: '',
  config: {
    variant: {
      default: 'plain',
      options: {
        // `plain` varies over nothing, and says so by being a plain string
        // rather than an expansion that ignores its axes.
        plain: '',
        card: over(SCALE, CHECKED, (tone, state) => {
          return cn(
            'rounded-6 border-1 px-10 py-6',
            state === 'on' ? `border-${tone}-9 bg-${tone}-3` : 'border-gray-7 hover:border-gray-9',
          );
        }),
      },
    },
  },
});

// Circle and inner dot scale together: the dot stays half the circle so the
// 2px accent ring around it reads the same at every rung.
// The ladder's mark column, not a copy of it — a radio and a checkbox at the
// same size have to be the same circle, and that only stays true if both read
// the one table.
const CIRCLE: Record<ControlSize, string> = {
  xs: CONTROL_LADDER.xs.mark,
  md: CONTROL_LADDER.md.mark,
  lg: CONTROL_LADDER.lg.mark,
};
const DOT: Record<ControlSize, string> = { xs: 'size-6', md: 'size-8', lg: 'size-10' };
const ROW_GAP: Record<ControlSize, string> = { xs: 'gap-12', md: 'gap-16', lg: 'gap-20' };
// Cards carry their own padding, so they sit closer together than bare rows.
const CARD_GAP: Record<ControlSize, string> = { xs: 'gap-6', md: 'gap-8', lg: 'gap-10' };

/** One choice from a few options, every option visible. */
export function RadioGroup({
  id,
  'aria-describedby': ariaDescribedBy,
  name,
  label,
  value,
  options,
  onChange,
  variant = 'plain',
  size = 'md',
  tone = 'primary',
  disabled,
  readOnly,
  className,
}: RadioGroupProps) {
  // One id serves both jobs. `name` only has to be unique per group, which is
  // exactly what useId promises, and the legend needs an id for the group to
  // point at.
  const uid = useId();
  const groupName = name ?? uid;
  const legendId = `${uid}legend`;
  const scale = TONE_HUE[tone];
  return (
    <fieldset
      id={id}
      aria-describedby={ariaDescribedBy}
      // A bare `<fieldset>` is `role="group"`, and `aria-readonly` is not
      // defined on that role — it would be dropped on the floor. Naming the
      // role the content already implements is what makes the read-only state
      // reach an assistive tech at all. `aria-labelledby` restates what the
      // legend already says, so the name survives the explicit role.
      role="radiogroup"
      aria-labelledby={legendId}
      aria-readonly={readOnly ? true : undefined}
      className={cn(
        'm-0 flex items-center border-0 p-0',
        variant === 'card' ? CARD_GAP[size] : ROW_GAP[size],
        className,
      )}
    >
      <legend id={legendId} className="sr-only">
        {label}
      </legend>
      {options.map((option) => {
        // Group-level `disabled` is the floor; an option can also opt out on
        // its own. Read-only sets neither — it keeps the tab stop and keeps the
        // value in the form, and only declines the edit.
        const optionDisabled = Boolean(disabled) || Boolean(option.disabled);
        return (
          <label
            key={option.value}
            className={toggleRowClass({
              size,
              className: cn(
                optionClass({
                  variant,
                  scale,
                  state: value === option.value ? 'on' : 'off',
                }),
                readOnly && readOnlyMarkClass,
              ),
            })}
          >
            <span className={cn('relative inline-flex shrink-0', CIRCLE[size])}>
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={value === option.value}
                disabled={optionDisabled}
                // HTML's `readonly` does not reach a radio — the attribute is
                // inert here — so refusing to emit is the enforcement, and the
                // controlled `checked` above is what snaps the mark back.
                onChange={() => {
                  if (!readOnly) {
                    onChange(option.value);
                  }
                }}
                className={toggleMarkClass({
                  fill: 'ring',
                  scale,
                  className: cn('border-1.5 rounded-full', CIRCLE[size]),
                })}
              />
              {/* Inner dot as an overlay (not a thick border) so selected reads as a
                  2px accent ring around an accent dot. */}
              <span
                aria-hidden
                className={toggleGlyphClass({
                  on: 'solid',
                  scale,
                  className: cn(
                    'top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-full peer-checked:block',
                    DOT[size],
                  ),
                })}
              />
            </span>
            <span className={cn(optionDisabled && 'text-gray-9')}>{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
