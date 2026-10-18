import type { RendererProps } from '@bh/template';
import { Icon } from '../../primitives/components/icon';
import { noRenderers } from '../renderer-registry';
import { Each } from './each';
import { toneOf } from './look';

/** A check for true. False is read out, not shown. */
export function CheckRenderer({ values, part }: RendererProps) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        if (shown.value !== true) {
          return <span className="sr-only">{shown.text}</span>;
        }
        return <Icon name="check" tone={toneOf(part.tone ?? shown.tone)} label={shown.text} />;
      }}
    />
  );
}

export const checkRenderer = noRenderers.define({
  kinds: ['boolean'],
  Component: CheckRenderer,
});
