import type { RendererProps } from '@bh/template';
import { defineRenderer } from '../renderer-registry';
import { joined, ownTone } from './each';
import { PartText } from './look';

/** Its text, any kind. */
export function TextRenderer({ values, part }: RendererProps) {
  return (
    <PartText part={part} tone={ownTone(values)}>
      {joined(values)}
    </PartText>
  );
}

export const textRenderer = defineRenderer({
  kinds: 'any',
  Component: TextRenderer,
});
