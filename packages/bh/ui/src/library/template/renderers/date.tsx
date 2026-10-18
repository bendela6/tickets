import type { RendererProps } from '@bh/template';
import { formatExact } from '../../primitives/components/relative-date';
import { noRenderers } from '../renderer-registry';
import { Each } from './each';
import { PartText } from './look';

/** A date, the exact moment on hover. */
export function DateRenderer({ values, part }: RendererProps) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        const value = String(shown.value);
        const exact = Number.isNaN(Date.parse(value)) ? undefined : formatExact(value);
        return (
          <PartText part={part} tone={shown.tone}>
            <time dateTime={value} title={exact}>
              {shown.text}
            </time>
          </PartText>
        );
      }}
    />
  );
}

export const dateRenderer = noRenderers.define({
  kinds: ['date', 'datetime'],
  Component: DateRenderer,
});
