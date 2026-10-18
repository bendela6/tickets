import type { RendererProps } from '@bh/template';
import { defineRenderer } from '../renderer-registry';
import { joined } from './each';
import { PartText } from './look';

/** JSON or text, in mono. */
export function CodeRenderer({ values, part }: RendererProps) {
  return (
    <PartText part={{ ...part, mono: true }}>
      <code>{joined(values)}</code>
    </PartText>
  );
}

export const codeRenderer = defineRenderer({
  kinds: ['json', 'text'],
  Component: CodeRenderer,
});
