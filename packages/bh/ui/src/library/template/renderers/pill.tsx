import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { Pill } from '../../primitives/components/pill';
import { defineRenderer } from '../renderer-registry';
import { Each } from './each';
import { toneOf } from './look';

const pillOptions = v.strictObject({
  /** The Pill variant. Default `subtle`. */
  variant: v.optional(v.picklist(['subtle', 'solid', 'outline', 'text', 'tint'])),
});

export type PillOptions = v.InferOutput<typeof pillOptions>;

/** Each value in a pill, in its tone. */
export function PillRenderer({ values, options, part }: RendererProps<PillOptions>) {
  // Its own span: a grid cell or a stack stretches its item, not the pill.
  return (
    <span className="inline-flex max-w-full min-w-0">
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
    </span>
  );
}

export const pillRenderer = defineRenderer({
  kinds: ['option', 'text'],
  options: pillOptions,
  Component: PillRenderer,
});
