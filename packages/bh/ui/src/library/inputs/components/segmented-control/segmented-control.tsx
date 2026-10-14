import { axis, cn, focusRing, HUES, over, TONE_HUE, variants } from '../../../../style';
import { Icon, type IconSize } from '../../../primitives/components/icon';
import {
  CONTROL_LADDER,
  readOnlyMarkClass,
  type ControlProps,
  type ControlSize,
  type Option,
  disabledTreatment,
} from '../../contract';
import { useSegmentTile } from './use-segment-tile';

// 12 / 14 / 16 — the same three numbers `CONTROL_LADDER` carries as `icon`,
// said in the glyph ladder's own vocabulary because that is what `Icon` takes.
const GLYPH: Record<ControlSize, IconSize> = { xs: 'sm', md: 'md', lg: 'lg' };

/**
 * An option's icon in its `color`: the text rung, 11, on the chosen segment,
 * and a rung down on the others, lifted under the pointer, as their labels
 * are dimmed (gray 11 for 12) and lifted. A disabled segment dims it with its
 * label. Through `variants()` because the classes are interpolated per hue,
 * and the safelist holds `variants()` output only.
 */
const glyphClass = variants({
  base: '',
  config: {
    segment: {
      default: 'chosen',
      options: {
        chosen: over(axis('scale', HUES, 'indigo'), (hue) => `text-${hue}-11`),
        other: over(axis('scale', HUES, 'indigo'), (hue) => {
          return `text-${hue}-10 group-hover:text-${hue}-11`;
        }),
      },
    },
  },
});

export type SegmentedControlProps = ControlProps<string> & {
  /**
   * The segments, in the order given; an option's `icon` is drawn before its
   * label, in its `color` when it has one, and a `disabled` option can't be
   * picked.
   */
  options: Option[];
  /**
   * The group's accessible name.
   *
   * Required — a row of words is not a control until something says what the
   * row is FOR.
   */
  label: string;
};

/**
 * An exclusive choice for two to five short options, shown inline.
 *
 * The same decision a Combobox without search makes, spent differently: a
 * segmented control trades width for the ability to read every option without
 * opening anything.
 * Past about five it stops fitting and stops being scannable, which is why the
 * design bounds it — the type cannot enforce that, but the doc can say it.
 *
 * The indicator is a raised tile that GLIDES between segments rather than
 * appearing under the new one. The movement is the affordance: it says the
 * options are positions on one control, where a tile that blinked from place to
 * place would read as five separate buttons that happen to sit together.
 *
 * Each segment is as wide as its own label. It used to be `100 / n` percent of
 * the group, which bought the tile's geometry as arithmetic and paid for it
 * everywhere else: `All` was held out to the width of `Succeeded`, and a label
 * longer than its share spilled past the segment it belonged to, because
 * nothing here wraps. Content widths cost one measurement — see
 * `useSegmentTile` — and that is the whole of the trade.
 */
export function SegmentedControl({
  id,
  'aria-describedby': ariaDescribedBy,
  value,
  onChange,
  options,
  label,
  size = 'md',
  tone = 'primary',
  disabled = false,
  readOnly = false,
  className,
}: SegmentedControlProps) {
  const hue = TONE_HUE[tone];
  const rung = CONTROL_LADDER[size];
  const locked = disabled || readOnly;
  const selected = options.some((option) => option.value === value) ? value : null;
  // What the tile has to be re-measured for, beside the selection moving: the
  // labels themselves. An identity check on `options` would re-measure on every
  // render of every caller that builds the array inline, which is most of them.
  const revision = `${size}:${options.map((option) => option.label).join('\u0000')}`;
  const { listRef, registerSegment, tile } = useSegmentTile(selected, revision);

  return (
    <div
      id={id}
      aria-describedby={ariaDescribedBy}
      ref={listRef}
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      aria-readonly={readOnly || undefined}
      className={cn(
        // The floor a hovered field would use, so the group reads as one
        // recessed strip with the tile sitting proud of it.
        'bg-gray-5 relative isolate inline-flex p-2',
        rung.height,
        rung.radius,
        disabled && disabledTreatment,
        locked && readOnlyMarkClass,
        className,
      )}
    >
      {/* One tile, moved — not one tile per segment, lit. `-z-10` keeps it
          behind the labels so the text never fades through it mid-glide. */}
      {tile ? (
        <span
          aria-hidden
          className={cn(
            'bg-surface-raised absolute inset-y-2 -z-10 shadow-sm transition-[left,width] duration-220',
            rung.radius,
          )}
          style={{ left: tile.left, width: tile.width }}
        />
      ) : null}
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              registerSegment(option.value, node);
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled || option.disabled}
            // Read-only keeps every tab stop; only `disabled` gives them up.
            tabIndex={disabled ? -1 : 0}
            onClick={() => {
              if (locked || option.disabled) {
                return;
              }
              onChange(option.value);
            }}
            className={cn(
              // `flex-auto` grows from the label's own width rather than from
              // zero, so a group told to fill a wider box spreads the spare
              // pixels evenly instead of flattening the segments back to equal.
              //
              // Every label carries the selected weight, chosen and unchosen
              // alike. Weight used to arrive with the selection, which under
              // content widths is a segment that grows as it is picked and
              // shoves the ones after it sideways — with the tile chasing a box
              // that moved because the tile moved. Selection is said by the
              // tile and the colour; the type never changes size.
              'group font-500 relative flex flex-auto items-center justify-center font-sans whitespace-nowrap transition-colors',
              rung.padX,
              rung.text,
              rung.radius,
              // The ladder's own answer for the space between a control's
              // pieces, which at `md` is the same 8px Button puts between a
              // glyph and its label.
              rung.gap,
              // Inward, because this is a joined control — an outward halo would
              // spill over the segment next door and point at both.
              focusRing(hue, 'focus-visible', 'inward'),
              isSelected ? 'text-gray-12' : 'text-gray-11 hover:text-gray-12',
              option.disabled && disabledTreatment,
            )}
          >
            {option.icon ? (
              <Icon
                name={option.icon}
                size={GLYPH[size]}
                className={
                  option.color
                    ? glyphClass({ segment: isSelected ? 'chosen' : 'other', scale: option.color })
                    : undefined
                }
              />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
