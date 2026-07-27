import { Icon, type IconSize } from '../icon';
import type { Tone } from '../../style/tones';

// A thin preset over Icon's spin animation — the one loading indicator every
// screen reaches for instead of hand-rolling a CSS border-ring spinner. It
// shares Icon's size ladder because it is an icon.
//
// `tone` is unset by default (no default value), exactly like Icon: an
// unset tone applies no color class, so the spinner inherits `currentColor`
// from its surroundings (e.g. a button's own text color) rather than forcing
// a particular tone that callers then have to fight with a className override.
export function Spinner({
  size = 'md',
  tone,
  label = 'Loading',
  className,
}: {
  size?: IconSize;
  tone?: Tone;
  label?: string;
  className?: string;
}) {
  return (
    <Icon name="arc" size={size} tone={tone} animate="spin" label={label} className={className} />
  );
}
