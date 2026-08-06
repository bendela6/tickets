import {
  forwardRef,
  type HTMLAttributes,
  type MouseEventHandler,
  type Ref,
} from 'react';
import { axis, HUES, over, TONE_HUE, variants, type Tone } from '../../../../style';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'round' | 'square';
export type AvatarFont = 'sans' | 'mono';

// `children` is omitted because the content is derived from `name`; `color`
// because an avatar's colour comes from `tone`.
type AvatarProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'color' | 'onClick'> & {
  name: string;
  shape?: AvatarShape;
  /** Typeface for the initials. Independent of `shape` — a square avatar in
   *  sans is a legitimate combination, so the two are separate axes. */
  font?: AvatarFont;
  size?: AvatarSize;
  tone?: Tone;
  /** Present only when the avatar is itself actionable (an account menu's
   *  trigger). Its absence is what keeps the default a non-focusable span. */
  onClick?: MouseEventHandler<HTMLElement>;
  className?: string;
};

const avatarClass = variants({
  base: 'inline-flex shrink-0 items-center justify-center font-600',
  config: {
    shape: {
      default: 'round',
      options: {
        round: over(SCALE, (tone) => `rounded-full bg-${tone}-3 text-${tone}-9`),
        square: over(SCALE, (tone) => `rounded-md bg-${tone}-3 text-${tone}-9`),
      },
    },
    font: {
      default: 'sans',
      options: { sans: 'font-sans', mono: 'font-mono' },
    },
    // Avatars sit on their own scale — 16 to 36px — not the 28/36/44 control
    // ladder. `sm` is 18px here because an avatar is a glyph inside a row, not
    // something you click; the words are relative within the component.
    size: {
      default: 'sm',
      options: {
        xs: 'size-16 text-9',
        sm: 'size-18 text-9',
        md: 'size-22 text-10',
        lg: 'size-28 text-12',
        xl: 'size-36 text-15',
      },
    },
  },
});

function initials(name: string) {
  const parts = name.trim().split(/[\s-]+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Forwards its ref and spreads unknown props so an avatar can serve as an
 * overlay trigger (`<Dropdown trigger={<Avatar … />}>` — an account menu).
 * Like Pill, it becomes a real `<button>` only once something gives it an
 * `onClick`, which radix does when it clones the trigger; a decorative avatar
 * stays a non-focusable span so it never enters the tab order.
 */
export const Avatar = forwardRef<HTMLElement, AvatarProps>(function Avatar(
  {
    name,
    shape = 'round',
    font = 'sans',
    size = 'sm',
    tone = 'primary',
    onClick,
    className,
    ...rest
  },
  ref,
) {
  const classes = avatarClass({ shape, font, size, scale: TONE_HUE[tone], className });
  if (onClick) {
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        title={name}
        onClick={onClick}
        className={classes}
        {...rest}
      >
        {initials(name)}
      </button>
    );
  }
  return (
    <span ref={ref as Ref<HTMLSpanElement>} title={name} className={classes} {...rest}>
      {initials(name)}
    </span>
  );
});
