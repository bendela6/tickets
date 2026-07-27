import { HUE_TONES, STEP, TONE_SCALE, variants, type Tone } from '../../style';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarKind = 'human' | 'agent';

type AvatarProps = {
  name: string;
  kind: AvatarKind;
  size?: AvatarSize;
  /** Overrides the per-kind default ramp — `human` is cyan, `agent` primary. */
  tone?: Tone;
  className?: string;
};

// Kind is a real variant axis: it carries the shape and the typeface, not just
// a colour. A human reads as a round slot in a sans face, an agent as a square
// token in mono. Only the colour was ever a tone, and it was hardcoded.
const avatarClass = variants({
  base: 'inline-flex shrink-0 items-center justify-center font-semibold',
  config: {
    kind: {
      default: 'human',
      params: { scale: { default: TONE_SCALE.primary, values: HUE_TONES } },
      options: ({ scale }: { scale?: string }) => ({
        human: `rounded-full bg-${scale}-${STEP.bgSubtle} font-sans text-${scale}-${STEP.solid}`,
        agent: `rounded-md bg-${scale}-${STEP.bgSubtle} font-mono text-${scale}-${STEP.solid}`,
      }),
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

// What each kind painted before `tone` existed, kept as the default so no
// avatar changes colour on its own.
const DEFAULT_TONE: Record<AvatarKind, Tone> = { human: 'cyan', agent: 'primary' };

function initials(name: string) {
  const parts = name.trim().split(/[\s-]+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Avatar({ name, kind, size = 'sm', tone, className }: AvatarProps) {
  return (
    <span
      title={name}
      className={avatarClass({
        kind,
        size,
        scale: TONE_SCALE[tone ?? DEFAULT_TONE[kind]],
        className,
      })}
    >
      {initials(name)}
    </span>
  );
}
