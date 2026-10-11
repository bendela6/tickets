import { useState } from 'react';
import { axis, cn, focusRing, HUES, over, TONE_HUE, variants, type Hue } from '../../../../style';
import { ComboboxList } from '../../parts/combobox-list';
import { Popover, PopoverContent, PopoverTrigger } from '../../../overlays/components/popover';
import {
  CONTROL_LADDER,
  disabledTreatment,
  readOnlyMarkClass,
  type ControlProps,
  type Option,
} from '../../contract';

// Which ramp a pressed chip paints from: its option's colour, else `tone`'s.
const SCALE = axis('scale', HUES, 'indigo');

/**
 * One chip. Pressed is a tinted fill with a rule of the same hue; resting is a
 * plain raised chip. The rule is kept in both states so the chip does not grow
 * a pixel when it is pressed.
 *
 * Through `variants()` because the pressed classes are interpolated per hue,
 * and the extractor collects `variants()` output only.
 */
const chipClass = variants({
  base: 'inline-flex shrink-0 items-center font-sans font-500 whitespace-nowrap border-1 transition-colors',
  config: {
    pressed: {
      default: 'off',
      options: {
        off: 'border-gray-6 bg-surface-raised text-gray-11 hover:border-gray-8 hover:text-gray-12',
        // Gray has no hue to say "pressed" with: its rung 3 on rung 7 sits one
        // step from the resting chip, so a pressed Pending read as unpressed
        // beside a resting Succeeded. It steps up in contrast instead.
        on: over(SCALE, (hue) => {
          return hue === 'gray'
            ? 'border-gray-9 bg-gray-5 text-gray-12'
            : `border-${hue}-7 bg-${hue}-3 text-${hue}-11`;
        }),
      },
    },
    focus: {
      default: 'on',
      options: { on: over(SCALE, (hue) => focusRing(hue, 'focus-visible')) },
    },
    size: {
      default: 'md',
      options: {
        xs: [
          CONTROL_LADDER.xs.height,
          CONTROL_LADDER.xs.radius,
          CONTROL_LADDER.xs.text,
          'gap-6 px-9',
        ],
        md: [
          CONTROL_LADDER.md.height,
          CONTROL_LADDER.md.radius,
          CONTROL_LADDER.md.text,
          'gap-8 px-12',
        ],
        lg: [
          CONTROL_LADDER.lg.height,
          CONTROL_LADDER.lg.radius,
          CONTROL_LADDER.lg.text,
          'gap-9 px-14',
        ],
      },
    },
  },
});

/** The swatch in front of a coloured option, so a status reads as its colour before it is pressed. */
const dotClass = variants({
  base: 'size-6 shrink-0 rounded-full',
  config: {
    fill: { default: 'on', options: { on: over(SCALE, (hue) => `bg-${hue}-9`) } },
  },
});

export type ToggleChipsProps = ControlProps<string[]> & {
  /**
   * The chips, in the order given; an option's `color` draws a dot before its
   * label and paints it when pressed, and a `disabled` option can't be pressed.
   */
  options: Option[];
  /**
   * The group's accessible name, also used in the `+N` chip's.
   *
   * Required — a row of words is not a control until something says what the
   * row is for.
   */
  label: string;
  /**
   * How many options are laid out as chips; the rest sit behind a `+N` chip
   * that opens a searchable list.
   *
   * Default 6: past that a row of chips stops being something you can read at a
   * glance, which is the whole reason to use one.
   */
  maxVisible?: number;
};

/**
 * A multiple choice among a few short options, every one visible and one click
 * away: status pills in a filter bar.
 *
 * The inline sibling of `MultiCombobox`, the way `SegmentedControl` is the
 * inline sibling of `Select` — the same value, spent differently. Each chip is
 * a toggle button (`aria-pressed`) in a labelled group, so a screen reader
 * hears "Failed, toggle button, pressed" rather than a list of links.
 */
export function ToggleChips({
  id,
  'aria-describedby': ariaDescribedBy,
  value,
  onChange,
  options,
  label,
  maxVisible = 6,
  size = 'md',
  tone = 'primary',
  disabled = false,
  readOnly = false,
  className,
}: ToggleChipsProps) {
  const toneHue = TONE_HUE[tone];
  const [open, setOpen] = useState(false);
  const locked = disabled || readOnly;
  const shown = options.slice(0, maxVisible);
  const hidden = options.slice(maxVisible);
  const hiddenPressed = hidden.filter((option) => {
    return value.includes(option.value);
  }).length;

  function toggle(entry: string) {
    if (locked) {
      return;
    }
    onChange(value.includes(entry) ? value.filter((item) => item !== entry) : [...value, entry]);
  }

  return (
    <div
      id={id}
      aria-describedby={ariaDescribedBy}
      role="group"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cn(
        'flex flex-wrap items-center gap-6',
        disabled && disabledTreatment,
        readOnly && readOnlyMarkClass,
        className,
      )}
    >
      {shown.map((option) => {
        const pressed = value.includes(option.value);
        const scale: Hue = option.color ?? toneHue;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            // ARIA allows no `aria-readonly` on a button or a group: read-only
            // keeps the tab stop and says not-operable, as Combobox does.
            aria-disabled={readOnly || undefined}
            disabled={disabled || option.disabled}
            onClick={() => {
              if (!option.disabled) {
                toggle(option.value);
              }
            }}
            className={chipClass({
              pressed: pressed ? 'on' : 'off',
              scale,
              size,
              className: option.disabled ? disabledTreatment : undefined,
            })}
          >
            {option.color ? <span aria-hidden className={dotClass({ scale })} /> : null}
            {option.label}
          </button>
        );
      })}
      {hidden.length > 0 ? (
        <Popover
          open={open && !locked}
          onOpenChange={(next) => {
            if (!locked) {
              setOpen(next);
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${hidden.length} more ${label.toLowerCase()} options`}
              disabled={disabled}
              className={chipClass({
                pressed: hiddenPressed > 0 ? 'on' : 'off',
                scale: toneHue,
                size,
              })}
            >
              +{hidden.length}
              {hiddenPressed > 0 ? <span className="text-11">({hiddenPressed})</span> : null}
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0">
            <ComboboxList
              options={hidden}
              keepOpen
              isSelected={(candidate) => value.includes(candidate)}
              onPick={toggle}
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
