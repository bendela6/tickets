import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { cn, HUE_TONES, STEP, TONE_SCALE, variants, type Tone, type ToneEmphasis } from '../../style';
import { Icon, type IconName } from '../icon';

/** How loudly the tone reads. The same four treatments the tone contract
 *  defines — this is the emphasis axis, surfaced as the component's variant. */
export type PillVariant = ToneEmphasis;

export type PillSize = 'sm' | 'md' | 'lg';

/** Corner treatment. `square` lines up with the surrounding controls; `round`
 *  reads as a tag or a count. Neither is a size — they used to be spelled
 *  `md` and `full`, which collided with the size vocabulary. */
export type PillShape = 'square' | 'round';

// The four variants rebuild what `toneClasses()` returns, but from `STEP` and a
// scale param so hover/opacity variants can be added later without a second
// vocabulary. A test asserts the two agree for every tone, since a Pill and a
// Button asking for the same treatment must not diverge.
const pillClass = variants({
  base: 'inline-flex items-center font-sans font-medium',
  config: {
    variant: {
      default: 'subtle',
      params: { scale: { default: TONE_SCALE.neutral, values: HUE_TONES } },
      options: ({ scale }: { scale?: string }) => ({
        subtle: `bg-${scale}-${STEP.bgSubtle} text-${scale}-${STEP.text}`,
        solid: `bg-${scale}-${STEP.solid} text-${scale}-${STEP.contrast}`,
        outline: `border-(length:--border-thick) border-${scale}-${STEP.border} text-${scale}-${STEP.text}`,
        text: `text-${scale}-${STEP.text}`,
      }),
    },
    shape: {
      default: 'square',
      options: {
        square: 'rounded-md',
        round: 'rounded-full',
      },
    },
    size: {
      default: 'md',
      options: {
        sm: 'h-4.5 gap-1 px-1.75 text-label',
        md: 'h-5.5 gap-1.5 px-2.25 text-meta',
        lg: 'h-7 gap-2 px-3 text-ui',
      },
    },
  },
});

// The leading glyph scales with the pill rather than being pinned at 10px.
const ICON_SIZE: Record<PillSize, number> = { sm: 9, md: 10, lg: 12 };

export function Pill({
  label,
  tone = 'neutral',
  variant = 'subtle',
  icon,
  shape = 'square',
  size = 'md',
  trailing,
  strikethrough,
  onClick,
  pressed,
  disabled,
  className,
}: {
  label: ReactNode;
  tone?: Tone;
  variant?: PillVariant;
  icon?: IconName | ReactElement;
  shape?: PillShape;
  size?: PillSize;
  trailing?: ReactNode;
  strikethrough?: boolean;
  onClick?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {isValidElement(icon) ? icon : icon ? <Icon name={icon} size={ICON_SIZE[size]} /> : null}
      {strikethrough ? <s className="line-through">{label}</s> : label}
      {trailing}
    </>
  );
  const classes = (extra?: string) =>
    pillClass({
      variant,
      shape,
      size,
      scale: TONE_SCALE[tone],
      className: cn(extra, className),
    });

  if (onClick) {
    // Native `disabled` gives correct focus + AT semantics for free — no
    // `aria-disabled` needed alongside it. `cursor-default` (not
    // `pointer-events-none`) since native disabled already blocks activation.
    return (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={pressed}
        onClick={onClick}
        className={classes(disabled ? 'cursor-default opacity-50' : undefined)}
      >
        {body}
      </button>
    );
  }
  // No onClick means this is a static `<span>` — a span can't be disabled,
  // so `disabled` is meaningless here and intentionally ignored.
  return <span className={classes()}>{body}</span>;
}
