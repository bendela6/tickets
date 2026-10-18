import type { RendererProps } from '@bh/template';
import { defineRenderer } from '../renderer-registry';
import { joined, ownTone } from './each';
import { PartText } from './look';

/** A number, its digits of even width. */
export function NumberRenderer({ values, part }: RendererProps) {
  return (
    <PartText part={part} tone={ownTone(values)} className="tabular-nums">
      {joined(values)}
    </PartText>
  );
}

export const numberRenderer = defineRenderer({
  kinds: ['number'],
  Component: NumberRenderer,
});
