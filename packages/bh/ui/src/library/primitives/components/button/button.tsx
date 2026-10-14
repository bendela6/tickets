import {
  forwardRef,
  type ButtonHTMLAttributes,
  type FocusEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { axis, focusRing, HUES, over, TONE_HUE, variants, type Tone } from '../../../../style';
import { Icon, type IconName, type IconSize } from '../icon';
import { Spinner } from '../../../feedback/components/spinner';
import { Tooltip } from '../../../overlays/components/tooltip';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

/**
 * How much of the tone the button spends. Shares three of its four names with
 * Pill so `variant="solid"` means the same thing library-wide. Pill's fourth is
 * `text`; a button's is `ghost`, because ours takes a hover surface and a text
 * button does not — same word for different treatments would be worse than two
 * words for two treatments.
 */
export type ButtonVariant = 'subtle' | 'solid' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
/** An icon-only button's sizes: a text button's three, and `xs`, which only a glyph fits. */
export type IconButtonSize = 'xs' | ButtonSize;

// The props both forms take are split around the two forms' own, so the props
// table reads them in this file's order: look, size, glyph, label, the rest.
type LookProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** How much of the tone the button spends. */
  variant?: ButtonVariant;
  /** Which ramp the variant paints from: a role, or a hue by name. */
  tone?: Tone;
};

/** A square button that shows a glyph alone, named by its `label`, which is also its tooltip. */
type IconButtonProps = LookProps &
  RestProps & {
    /** Height, padding, radius and type size, as one step: 24 (icon-only), 28, 36 and 44 pixels. */
    size?: IconButtonSize;
    /** Draws a glyph alone, in place of words: an icon's name, or an element for a glyph the registry lacks. The button is square, and `label` names it. */
    icon: IconName | ReactElement;
    /** The tooltip. With `icon`, also the button's name, and required. */
    label: string;
    chevron?: never;
    children?: never;
  };

/** A button that says what it does in words. */
type TextButtonProps = LookProps &
  RestProps & {
    /** Height, padding, radius and type size, as one step: 24 (icon-only), 28, 36 and 44 pixels. */
    size?: ButtonSize;
    /** Draws a glyph alone, in place of words: an icon's name, or an element for a glyph the registry lacks. The button is square, and `label` names it. */
    icon?: never;
    /** The tooltip. With `icon`, also the button's name, and required. */
    label?: string;
    /** Adds a trailing chevron, for a button that opens a menu or a popover. */
    chevron?: boolean;
    /** The label. */
    children?: ReactNode;
  };

interface RestProps {
  /** Shows a spinner before the label, or in the glyph's place, and disables the button, keeping its fill. Sets `aria-busy`. */
  loading?: boolean;
  /** Added to the button's own classes. */
  className?: string;
}

/** A button with a label in words, or, given `icon`, a glyph alone. */
export type ButtonProps = IconButtonProps | TextButtonProps;

// Per-variant fill/text/border + hover + focus halo, matching the design spec,
// docs/design/design-system.html §06 Buttons. Solid gets a 1px inset
// app-colored ring inside the 3px accent halo
// (design: `0 0 0 3px var(--acs), 0 0 0 1px var(--bg) inset`); outline swaps
// its border to accent on focus.
//
// Each option is written once and expanded over `SCALE` — the axis names the
// `scale` prop and owns its domain, so this file never restates which ramps
// exist. `tone` is the bare scale name and the rung is spelled here: 3-5 are
// component fills, 7-8 borders, 9-10 solid fills, 11-12 text, the same ladder
// on every scale (see the Colors page). None of these classes exist as literal
// text anywhere, so `bg-green-9`/`hover:bg-green-10` only reach the safelist
// because the enumeration walks the axis over all 11 ramps.
//
// Read each option down, not across: fill, text, border, focus, extra.
const buttonClass = variants({
  base: [
    'inline-flex items-center justify-center gap-8 font-sans font-500',
    'transition-colors select-none active:translate-y-px',
    'focus-visible:outline-none',
    'disabled:pointer-events-none',
  ],
  config: {
    variant: {
      default: 'outline',
      options: {
        solid: over(SCALE, (tone) => {
          return [
            `bg-${tone}-9 hover:bg-${tone}-10`,
            `text-${tone}-contrast`,
            'border-1 border-transparent',
            focusRing(tone),
            'focus-visible:shadow-[inset_0_0_0_1px_var(--color-gray-1)]',
          ];
        }),
        subtle: over(SCALE, (tone) => {
          return [
            `bg-${tone}-3 hover:bg-${tone}-4`,
            `text-${tone}-11`,
            'border-1 border-transparent',
            focusRing(tone),
          ];
        }),
        // Border and text follow the tone, matching what `TONES.outline`
        // resolves to for a Pill asking for the same treatment — the two must
        // not diverge on a shared variant name.
        outline: over(SCALE, (tone) => {
          return [
            `bg-surface-raised hover:bg-${tone}-3`,
            `text-${tone}-11`,
            `border-2 border-${tone}-7 hover:border-${tone}-8`,
            [focusRing(tone), `focus-visible:border-${tone}-9`],
          ];
        }),
        // Ghost is Button's answer to Pill's `text` emphasis — the same tone
        // text, plus the hover surface a button needs and a tag does not.
        ghost: over(SCALE, (tone) => {
          return [
            `bg-transparent hover:bg-${tone}-4`,
            `text-${tone}-11 hover:text-${tone}-12`,
            'border-1 border-transparent',
            focusRing(tone),
          ];
        }),
      },
    },
    // NOTE: font-size utilities here use arbitrary lengths (text-12/text-13)
    // rather than the semantic `text-13/19`/`text-12/17` tokens on purpose. tailwind-merge
    // does not know those custom named sizes are font-sizes, so it groups them with
    // `text-{color}` utilities and silently drops the color (e.g. text-indigo-contrast).
    // Arbitrary lengths are classified as font-size, so the variant color survives.
    // Radius is per-size: the design's 6 / 8 / 10 px, snapped to the scale's
    // md / lg / xl. Only `lg` moves — 10px was never a rung.
    size: {
      default: 'md',
      options: {
        xs: 'h-24 px-6 rounded-6 text-12',
        sm: 'h-28 px-10 rounded-6 text-12',
        md: 'h-36 px-14 rounded-8 text-13',
        lg: 'h-44 px-[18px] rounded-12 text-14',
      },
    },
    // An icon-only button is as wide as it is high, at every size. Set only
    // when there is an `icon`, so it has no default; after `size`, so its
    // `px-0` evicts the size's padding.
    square: {
      options: {
        xs: 'w-24 shrink-0 px-0',
        sm: 'w-28 shrink-0 px-0',
        md: 'w-36 shrink-0 px-0',
        lg: 'w-44 shrink-0 px-0',
      },
    },
  },
});

// Design's DISABLED row swaps colours per variant rather than a blanket dim;
// appended after the variant classes so tailwind-merge evicts the base
// fill/text/border. Applied only when the button is genuinely disabled — a
// loading button is also `disabled` but must keep its full variant fill
// (design LOADING row), so these are gated on !loading.
//
// These are deliberately tone-independent: a disabled control is out of play,
// and tinting it with its tone would keep drawing attention to a thing that
// cannot be used.
const DISABLED: Record<ButtonVariant, string> = {
  solid: 'bg-surface-inset text-gray-9',
  subtle: 'bg-surface-inset text-gray-9',
  outline: 'bg-gray-1 text-gray-9 border-gray-6',
  ghost: 'text-gray-9 opacity-60',
};

const CHEVRON: Record<IconButtonSize, IconSize> = { xs: 'sm', sm: 'sm', md: 'sm', lg: 'md' };
const SPINNER: Record<IconButtonSize, IconSize> = { xs: 'sm', sm: 'sm', md: 'sm', lg: 'md' };
// An icon-only button's glyph, about half its height: 12 in 24, 14 in 28, 16
// in 36 and 20 in 44. Its spinner takes the same size, so a loading icon
// button keeps its glyph's footprint.
const GLYPH: Record<IconButtonSize, IconSize> = { xs: 'sm', sm: 'md', md: 'lg', lg: 'xl' };

/** Starts an action: save, open a dialog, run a job. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'outline',
    tone = 'primary',
    size = 'md',
    loading = false,
    chevron = false,
    icon,
    label,
    className,
    children,
    disabled,
    onFocus,
    ...rest
  },
  ref,
) {
  const iconOnly = icon !== undefined;
  const showDisabled = Boolean(disabled) && !loading;
  const button = (
    <button
      ref={ref}
      type="button"
      disabled={Boolean(disabled) || loading}
      aria-busy={loading || undefined}
      // An icon-only button's name. A text button is named by its words, and
      // its `label` is the tooltip alone. An `aria-label` in `rest` still wins.
      aria-label={iconOnly ? label : undefined}
      onFocus={
        label
          ? (event) => {
              onFocus?.(event);
              keyboardFocusOnly(event);
            }
          : onFocus
      }
      className={buttonClass({
        variant,
        scale: TONE_HUE[tone],
        size,
        square: iconOnly ? size : undefined,
        className: showDisabled ? `${DISABLED[variant]} ${className ?? ''}`.trim() : className,
      })}
      {...rest}
    >
      {iconOnly ? (
        <IconOnlyGlyph icon={icon} size={GLYPH[size]} loading={loading} />
      ) : (
        <>
          {loading ? <Spinner size={SPINNER[size]} /> : null}
          {children}
          {chevron ? <Icon name="chevron-down" size={CHEVRON[size]} className="-mr-2" /> : null}
        </>
      )}
    </button>
  );
  if (!label) {
    return button;
  }
  // A disabled button hears no pointer (`disabled:pointer-events-none`, and
  // browsers send a disabled control few events), so its tooltip hangs on a
  // span around it instead, and still says on hover what the button would do.
  return (
    <Tooltip content={label}>
      {Boolean(disabled) || loading ? <span className="inline-flex">{button}</span> : button}
    </Tooltip>
  );
});

/**
 * Lets focus open the tooltip only when it came from the keyboard. Radix opens
 * a tooltip on any focus, so a drawer focusing its Close button, or a menu
 * handing focus back to its trigger, after a click, would show one nobody
 * asked for. Radix skips its own handler when an earlier one prevented the
 * default, which a focus event has no other use for.
 */
function keyboardFocusOnly(event: FocusEvent<HTMLButtonElement>) {
  if (!focusVisible(event.currentTarget)) {
    event.preventDefault();
  }
}

function focusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    // An engine that can't parse the selector keeps Radix's own behaviour.
    return true;
  }
}

/** An icon-only button's glyph: the registry's at the button's size, an element as given, or the spinner in its place. */
function IconOnlyGlyph({
  icon,
  size,
  loading,
}: {
  icon: IconName | ReactElement;
  size: IconSize;
  loading: boolean;
}) {
  if (loading) {
    return <Spinner size={size} />;
  }
  return typeof icon === 'string' ? <Icon name={icon} size={size} /> : icon;
}
