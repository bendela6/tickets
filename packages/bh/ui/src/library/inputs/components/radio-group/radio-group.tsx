import { useId } from 'react';
import { axis, cn, HUES, over, TONE_HUE, variants } from '../../../../style';
import { Icon, type IconSize } from '../../../primitives/components/icon';
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
 * How the options are laid out.
 *
 * `row` keeps them on one line, which suits a few short options. `grid` gives
 * each an equal column, as many as fit at 200px or more and one on a phone,
 * which suits cards with a line of description: three choices side by side in
 * a form, stacked in a drawer, with no breakpoint to pick.
 */
export type RadioGroupLayout = 'row' | 'grid';

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
  /**
   * The choices, a radio each, in the order given; a `disabled` option can't be
   * chosen. An option's `icon` goes before its label and its `description`
   * under it.
   */
  options: Option[];
  /**
   * How the options are drawn: `plain`, a mark and a label each, or `card`,
   * each a bordered hit area that lights up when chosen.
   */
  variant?: RadioGroupVariant;
  /**
   * How the options are laid out: `row`, on one line, or `grid`, in equal
   * columns of 200 pixels or more, one on a phone.
   */
  layout?: RadioGroupLayout;
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
// SegmentedControl's rungs, so an option's glyph is one size wherever it is drawn.
const GLYPH: Record<ControlSize, IconSize> = { xs: 'sm', md: 'md', lg: 'lg' };

// `grid` is equal columns of at least 200px, as many as fit: `min(100%, …)`
// lets one column shrink below that on a phone rather than overflow. A grid's
// items stretch to the tallest in their row, so cards line up whatever their
// line of description says; `items-center` stays the row's.
//
// `w-full` because "as many as fit" needs a width to fit into. Sized by its
// content instead, in a centred or a row parent, the grid counts the columns
// against no width at all and settles on one. A `className` width still wins.
const LAYOUT: Record<RadioGroupLayout, string> = {
  row: 'flex items-center',
  grid: 'grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]',
};

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
  layout = 'row',
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
  // Decided for the group, not per option, so cards side by side keep one
  // padding and one weight when only some of them have a line to say.
  const described = options.some((option) => Boolean(option.description));
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
        'm-0 border-0 p-0',
        LAYOUT[layout],
        variant === 'card' ? CARD_GAP[size] : ROW_GAP[size],
        className,
      )}
    >
      <legend id={legendId} className="sr-only">
        {label}
      </legend>
      {options.map((option, index) => {
        // Group-level `disabled` is the floor; an option can also opt out on
        // its own. Read-only sets neither — it keeps the tab stop and keeps the
        // value in the form, and only declines the edit.
        const optionDisabled = Boolean(disabled) || Boolean(option.disabled);
        // By index: a value is any string, and an id can't hold every one.
        const labelId = `${uid}option${index}`;
        const descriptionId = `${labelId}description`;
        const mark = (
          <span className={cn('relative inline-flex shrink-0', CIRCLE[size])}>
            <input
              type="radio"
              name={groupName}
              value={option.value}
              checked={value === option.value}
              disabled={optionDisabled}
              // The `<label>` around the radio would name it by all its text,
              // the description included. With a description, the label alone
              // names it and the description describes it, so a screen reader
              // says the choice, then what it does.
              {...(option.description
                ? { 'aria-labelledby': labelId, 'aria-describedby': descriptionId }
                : {})}
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
        );
        const text = (
          <span
            id={labelId}
            className={cn(
              option.icon && 'inline-flex items-center gap-6',
              described && 'font-500',
              optionDisabled && 'text-gray-9',
            )}
          >
            {option.icon ? <Icon name={option.icon} size={GLYPH[size]} /> : null}
            {option.label}
          </span>
        );
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
                // A card with two lines needs more room than one with a word,
                // and its mark sits by the first line, not between the two.
                described && 'items-start',
                described && variant === 'card' && 'px-12 py-10',
                readOnly && readOnlyMarkClass,
              ),
            })}
          >
            {described ? (
              <>
                {/* One line tall, so the circle centres on the label's line
                    whatever the size's leading is. */}
                <span className="flex h-[1lh] shrink-0 items-center">{mark}</span>
                <span className="flex min-w-0 flex-col">
                  {text}
                  {option.description ? (
                    <span
                      id={descriptionId}
                      className={cn('text-12/17', optionDisabled ? 'text-gray-9' : 'text-gray-11')}
                    >
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </>
            ) : (
              <>
                {mark}
                {text}
              </>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}
