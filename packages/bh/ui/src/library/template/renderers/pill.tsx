import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { Pill } from '../../primitives/components/pill';
import { noRenderers } from '../renderer-registry';
import { Each } from './each';
import { toneOf } from './look';

const pillOptions = v.strictObject({
  /** The Pill variant. Default `subtle`. */
  variant: v.optional(v.picklist(['subtle', 'solid', 'outline', 'text', 'tint'])),
});

export type PillOptions = v.InferOutput<typeof pillOptions>;

/** Each value in a pill, in its tone. */
export function PillRenderer({ values, options, part }: RendererProps<PillOptions>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        return (
          <Pill
            size="sm"
            variant={options.variant}
            tone={toneOf(part.tone ?? shown.tone) ?? 'neutral'}
            label={`${part.prefix ?? ''}${shown.text}`}
          />
        );
      }}
    />
  );
}

export const pillRenderer = noRenderers.define({
  kinds: ['option', 'text'],
  options: pillOptions,
  Component: PillRenderer,
});
