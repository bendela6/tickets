import { HUE_TONES, STEP, TONE_SCALE, variants, type Tone } from '../../style';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'round' | 'square';
export type AvatarFont = 'sans' | 'mono';

type AvatarProps = {
  name: string;
  shape?: AvatarShape;
  /** Typeface for the initials. Independent of `shape` — a square avatar in
   *  sans is a legitimate combination, so the two are separate axes. */
  font?: AvatarFont;
  size?: AvatarSize;
  tone?: Tone;
  className?: string;
};

const avatarClass = variants({
  base: 'inline-flex shrink-0 items-center justify-center font-semibold',
  config: {
    shape: {
      default: 'round',
      params: { scale: { default: TONE_SCALE.primary, values: HUE_TONES } },
      options: ({ scale }: { scale?: string }) => ({
        round: `rounded-full bg-${scale}-${STEP.bgSubtle} text-${scale}-${STEP.solid}`,
        square: `rounded-md bg-${scale}-${STEP.bgSubtle} text-${scale}-${STEP.solid}`,
      }),
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
        xs: 'size-4 text-[8px]',
        sm: 'size-4.5 text-[9px]',
        md: 'size-5.5 text-[10px]',
        lg: 'size-7 text-[12px]',
        xl: 'size-9 text-[15px]',
      },
    },
  },
});

function initials(name: string) {
  const parts = name.trim().split(/[\s-]+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Avatar({
  name,
  shape = 'round',
  font = 'sans',
  size = 'sm',
  tone = 'primary',
  className,
}: AvatarProps) {
  return (
    <span
      title={name}
      className={avatarClass({ shape, font, size, scale: TONE_SCALE[tone], className })}
    >
      {initials(name)}
    </span>
  );
}
