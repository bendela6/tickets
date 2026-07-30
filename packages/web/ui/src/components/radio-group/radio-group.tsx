import { axis, cn, HUE_TONES, over, TONE_SCALE, variants, type Tone } from '../../style';
import { toggleGlyphClass, toggleMarkClass, toggleRowClass, type ToggleSize } from '../toggle';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUE_TONES, 'indigo');

type RadioOption = { value: string; label: string; disabled?: boolean };

/**
 * How the choices are presented.
 *
 * `plain` is a row of marks and labels — right when the options are one word
 * each and the group sits inline. `card` gives each option its own bordered
 * hit area that lights up when selected, which is what you want when the
 * options need room, sit in a settings pane, or are being tapped.
 */
export type RadioGroupVariant = 'plain' | 'card';

type RadioGroupProps = {
  name: string;
  label: string;
  value: string;
  options: RadioOption[];
  onValueChange: (value: string) => void;
  variant?: RadioGroupVariant;
  size?: ToggleSize;
  /** Which ramp the selected dot and focus ring paint from. Defaults to `primary`. */
  tone?: Tone;
  className?: string;
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
        card: over(SCALE, CHECKED, (tone, state) =>
          cn(
            'rounded-md border-1 px-2.5 py-1.5',
            state === 'on'
              ? `border-${tone}-9 bg-${tone}-3`
              : 'border-gray-7 hover:border-gray-9',
          ),
        ),
      },
    },
  },
});

// Circle and inner dot scale together: the dot stays half the circle so the
// 2px accent ring around it reads the same at every rung.
const CIRCLE: Record<ToggleSize, string> = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' };
const DOT: Record<ToggleSize, string> = { sm: 'size-1.5', md: 'size-2', lg: 'size-2.5' };
const ROW_GAP: Record<ToggleSize, string> = { sm: 'gap-3', md: 'gap-4', lg: 'gap-5' };
// Cards carry their own padding, so they sit closer together than bare rows.
const CARD_GAP: Record<ToggleSize, string> = { sm: 'gap-1.5', md: 'gap-2', lg: 'gap-2.5' };

export function RadioGroup({
  name,
  label,
  value,
  options,
  onValueChange,
  variant = 'plain',
  size = 'md',
  tone = 'primary',
  className,
}: RadioGroupProps) {
  const scale = TONE_SCALE[tone];
  return (
    <fieldset
      className={cn(
        'm-0 flex items-center border-0 p-0',
        variant === 'card' ? CARD_GAP[size] : ROW_GAP[size],
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={toggleRowClass({
            size,
            className: optionClass({
              variant,
              scale,
              state: value === option.value ? 'on' : 'off',
            }),
          })}
        >
          <span className={cn('relative inline-flex shrink-0', CIRCLE[size])}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onValueChange(option.value)}
              className={toggleMarkClass({
                fill: 'ring',
                scale,
                className: cn('rounded-full border-2', CIRCLE[size]),
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
                  'left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 rounded-full peer-checked:block',
                  DOT[size],
                ),
              })}
            />
          </span>
          <span className={cn(option.disabled && 'text-gray-9')}>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
