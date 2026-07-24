import { cn } from '../cn';
import { toneClasses, type Tone } from '../tones';
import { registry, type IconName } from './registry';

export function Icon({
  name,
  size = 14,
  tone,
  animate,
  label,
  className,
}: {
  name: IconName;
  size?: number;
  tone?: Tone;
  animate?: 'spin' | 'pulse';
  label?: string;
  className?: string;
}) {
  const glyph = registry[name];
  return (
    <svg
      viewBox={glyph.viewBox}
      width={size}
      height={size}
      className={cn(
        'shrink-0',
        tone ? toneClasses(tone, 'text') : undefined,
        animate === 'spin' && 'animate-ai-spin',
        animate === 'pulse' && 'animate-ai-pulse',
        className,
      )}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {glyph.node}
    </svg>
  );
}
export type { IconName };
