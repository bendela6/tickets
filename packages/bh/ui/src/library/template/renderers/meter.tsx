import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { Meter } from '../../feedback/components/meter';
import { defineRenderer } from '../renderer-registry';
import { Each, numberOf } from './each';
import { PartText, toneOf } from './look';
import { positive } from './options';

const meterOptions = v.strictObject({
  /** The whole. Default 1. */
  max: v.optional(positive),
});

export type MeterOptions = v.InferOutput<typeof meterOptions>;

/** A share of a whole, toned by how full. */
export function MeterRenderer({ values, options, part, field }: RendererProps<MeterOptions>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        const value = numberOf(shown);
        if (value === undefined) {
          return <PartText part={part}>{shown.text}</PartText>;
        }
        return (
          <Meter
            label={field?.label ?? shown.text}
            fraction={value / (options.max ?? 1)}
            tone={toneOf(part.tone ?? shown.tone)}
            showLabel={false}
          />
        );
      }}
    />
  );
}

export const meterRenderer = defineRenderer({
  kinds: ['number'],
  options: meterOptions,
  minWidth: 80,
  Component: MeterRenderer,
});
