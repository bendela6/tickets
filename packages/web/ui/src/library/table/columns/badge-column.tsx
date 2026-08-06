import type { Renderer } from '@tickets/table';
import { Pill } from '../../primitives/components/pill';
import type { Tone } from '../../../style';

type BadgeColumnOpts<V> = {
  tone: (value: V) => Tone;
  label?: (value: V) => string;
};

export function BadgeColumn<V>(opts: BadgeColumnOpts<V>): Renderer<V> {
  return ({ value }) => {
    if (value == null) return null;
    return (
      <Pill
        size="sm"
        tone={opts.tone(value)}
        label={opts.label ? opts.label(value) : String(value)}
      />
    );
  };
}
