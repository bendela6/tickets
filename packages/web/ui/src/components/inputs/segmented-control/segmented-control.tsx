import { cn, focusRing, TONE_HUE } from '../../../style';
import { CONTROL_LADDER, readOnlyMarkClass, type ControlProps, type Option } from '../control';

export type SegmentedControlProps = ControlProps<string> & {
  options: Option[];
  /** Accessible name for the group. Required — a row of words is not a control
   *  until something says what the row is FOR. */
  label: string;
};

/**
 * An exclusive choice for two to five short options, shown inline.
 *
 * The same decision a Select makes, spent differently: a segmented control
 * trades width for the ability to read every option without opening anything.
 * Past about five it stops fitting and stops being scannable, which is why the
 * design bounds it — the type cannot enforce that, but the doc can say it.
 *
 * The indicator is a raised tile that GLIDES between segments rather than
 * appearing under the new one. The movement is the affordance: it says the
 * options are positions on one control, where a tile that blinked from place to
 * place would read as five separate buttons that happen to sit together.
 *
 * Equal-width segments make the glide a transform on one absolutely-positioned
 * element rather than a measurement of each label — no refs, no resize
 * observer, and no first-paint jump while the measurements settle.
 */
export function SegmentedControl({
  id,
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
  const index = options.findIndex((option) => option.value === value);
  const width = options.length > 0 ? 100 / options.length : 100;

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      aria-readonly={readOnly || undefined}
      className={cn(
        // The floor a hovered field would use, so the group reads as one
        // recessed strip with the tile sitting proud of it.
        'relative isolate inline-flex bg-gray-5 p-2',
        rung.height,
        rung.radius,
        disabled && 'opacity-50',
        locked && readOnlyMarkClass,
        className,
      )}
    >
      {/* One tile, moved — not one tile per segment, lit. `-z-10` keeps it
          behind the labels so the text never fades through it mid-glide. */}
      {index >= 0 ? (
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-2 -z-10 bg-surface-raised shadow-sm transition-[left] duration-220',
            rung.radius,
          )}
          style={{ left: `calc(${index * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
        />
      ) : null}
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled || option.disabled}
            // Read-only keeps every tab stop; only `disabled` gives them up.
            tabIndex={disabled ? -1 : 0}
            onClick={() => {
              if (locked || option.disabled) return;
              onChange(option.value);
            }}
            style={{ width: `${width}%` }}
            className={cn(
              'relative flex items-center justify-center whitespace-nowrap px-8 font-sans transition-colors',
              rung.text,
              rung.radius,
              // Inward, because this is a joined control — an outward halo would
              // spill over the segment next door and point at both.
              focusRing(hue, 'focus-visible', 'inward'),
              isSelected ? 'font-500 text-gray-12' : 'text-gray-11 hover:text-gray-12',
              option.disabled && 'cursor-default opacity-50',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
