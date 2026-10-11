import type { Renderer } from '@bh/table';
import { Pill } from '../../primitives/components/pill';
import type { Tone } from '../../../style';

interface BadgeColumnOpts<V> {
  /** The pill's tone for a value: a role or a hue by name. */
  tone: (value: V) => Tone;
  /** The pill's text for a value; the value itself, as a string, by default. */
  label?: (value: V) => string;
}

/** A cell that is a small Pill, its tone and text from the value. An empty value draws nothing. */
export function BadgeColumn<V>(opts: BadgeColumnOpts<V>): Renderer<V> {
  return ({ value }) => {
    if (value == null) {
      return null;
    }
    return (
      <Pill
        size="sm"
        tone={opts.tone(value)}
        label={opts.label ? opts.label(value) : String(value)}
      />
    );
  };
}
