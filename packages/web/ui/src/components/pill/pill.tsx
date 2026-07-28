import {
  forwardRef,
  isValidElement,
  type HTMLAttributes,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { cn, over, toneAxis, TONE_SCALE, variants, type Tone, type ToneEmphasis } from '../../style';
import { Icon, type IconName, type IconSize } from '../icon';

/** How loudly the tone reads. The same four treatments the tone contract
 *  defines — this is the emphasis axis, surfaced as the component's variant. */
export type PillVariant = ToneEmphasis;

export type PillSize = 'sm' | 'md' | 'lg';

/** Corner treatment. `square` lines up with the surrounding controls; `round`
 *  reads as a tag or a count. Neither is a size — they used to be spelled
 *  `md` and `full`, which collided with the size vocabulary. */
export type PillShape = 'square' | 'round';

// A Pill rests on neutral where a Button rests on primary — the resting ramp
// is the only per-component decision the tone axis leaves open.
const NEUTRAL_TONE = toneAxis(TONE_SCALE.neutral);

// The four variants rebuild what `toneClasses()` returns, but from the ramp's
// named rungs so hover/opacity variants can be added later without a second
// vocabulary. A test asserts the two agree for every tone, since a Pill and a
// Button asking for the same treatment must not diverge.
const pillClass = variants({
  base: 'inline-flex items-center font-sans font-500',
  config: {
    variant: {
      default: 'subtle',
      options: {
        subtle: over(NEUTRAL_TONE, (t) => `bg-${t.bgSubtle} text-${t.text}`),
        solid: over(NEUTRAL_TONE, (t) => `bg-${t.solid} text-${t.contrast}`),
        outline: over(
          NEUTRAL_TONE,
          (t) => `border-(length:--border-thick) border-${t.border} text-${t.text}`,
        ),
        text: over(NEUTRAL_TONE, (t) => `text-${t.text}`),
      },
    },
    shape: {
      default: 'square',
      options: {
        square: 'rounded-md',
        round: 'rounded-full',
      },
    },
    // `leading-none` is load-bearing, and it has to sit *after* the font size.
    // The text tokens each carry a ~1.4 line-height, and flex centres the line
    // box rather than the glyphs — inside a 22px pill that put the label 2.6px
    // from the top and 4.4px from the bottom, reading as too high. Collapsing
    // the line box centres it to within a rounding pixel. Written before
    // `text-meta`, tailwind-merge evicts it: a font-size token that also sets a
    // line-height wins the whole group.
    size: {
      default: 'md',
      options: {
        sm: 'h-4.5 gap-1 px-1.75 text-label leading-none',
        md: 'h-5.5 gap-1.5 px-2.25 text-meta leading-none',
        lg: 'h-7 gap-2 px-3 text-ui leading-none',
      },
    },
  },
});

// The leading glyph scales with the pill rather than being pinned at 10px.
const ICON_SIZE: Record<PillSize, IconSize> = { sm: '2xs', md: 'xs', lg: 'sm' };

// `children` is omitted because the content is `label`; `color` because a
// Pill's colour comes from `tone` and the DOM attribute of that name would
// read as an escape hatch that silently does nothing.
type PillProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'color' | 'onClick'> & {
  label: ReactNode;
  tone?: Tone;
  variant?: PillVariant;
  icon?: IconName | ReactElement;
  shape?: PillShape;
  size?: PillSize;
  trailing?: ReactNode;
  /** Adds a trailing chevron, for a pill that opens a menu or a popover. */
  chevron?: boolean;
  strikethrough?: boolean;
  /** Widened from `() => void` to the DOM handler so the event is reachable —
   *  a zero-arg callback still satisfies it, so existing call sites are
   *  unaffected. */
  onClick?: MouseEventHandler<HTMLElement>;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Forwards its ref and spreads unknown props so a Pill can serve as an
 * overlay trigger (`<Dropdown trigger={<Pill chevron … />}>`). radix anchors
 * a panel off the trigger's ref and writes `aria-expanded`/`data-state` onto
 * it; without both of those the pill would open the panel on click and then
 * misposition it, with nothing announced to assistive tech.
 */
export const Pill = forwardRef<HTMLElement, PillProps>(function Pill(
  {
    label,
    tone = 'neutral',
    variant = 'subtle',
    icon,
    shape = 'square',
    size = 'md',
    trailing,
    chevron = false,
    strikethrough,
    onClick,
    pressed,
    disabled,
    className,
    ...rest
  },
  ref,
) {
  const body = (
    <>
      {isValidElement(icon) ? icon : icon ? <Icon name={icon} size={ICON_SIZE[size]} /> : null}
      {strikethrough ? <s className="line-through">{label}</s> : label}
      {trailing}
      {chevron ? <Icon name="chevron-down" size={ICON_SIZE[size]} className="-mr-0.5" /> : null}
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
        // Both branches are HTMLElement subtypes, so the forwarded ref is
        // narrowed at the point it is attached rather than the prop being
        // split into two components per element type.
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        disabled={disabled}
        aria-pressed={pressed}
        onClick={onClick}
        className={classes(disabled ? 'cursor-default opacity-50' : undefined)}
        {...rest}
      >
        {body}
      </button>
    );
  }
  // No onClick means this is a static `<span>` — a span can't be disabled,
  // so `disabled` is meaningless here and intentionally ignored.
  return (
    <span ref={ref as Ref<HTMLSpanElement>} className={classes()} {...rest}>
      {body}
    </span>
  );
});
