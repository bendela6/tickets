import { Icon } from './icons/icon';
import type { Tone } from './tones';

// A thin preset over Icon's spin animation — the one loading indicator every
// screen reaches for instead of hand-rolling a CSS border-ring spinner.
export function Spinner({
  size = 14,
  tone = 'primary',
  className,
}: {
  size?: number;
  tone?: Tone;
  className?: string;
}) {
  return <Icon name="arc" size={size} tone={tone} animate="spin" label="Loading" className={className} />;
}
