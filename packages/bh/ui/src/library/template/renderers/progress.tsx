import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { Progress } from '../../feedback/components/progress';
import { noRenderers } from '../renderer-registry';
import { Each, numberOf } from './each';
import { PartText, toneOf } from './look';
import { positive } from './options';

const progressOptions = v.strictObject({
  /** What fills the bar. Default 100. */
  max: v.optional(positive),
});

export type ProgressOptions = v.InferOutput<typeof progressOptions>;

/** A bar: the value out of `max`, its text after. */
export function ProgressRenderer({ values, options, part, field }: RendererProps<ProgressOptions>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        const value = numberOf(shown);
        if (value === undefined) {
          return <PartText part={part}>{shown.text}</PartText>;
        }
        return (
          <Progress
            value={(value / (options.max ?? 100)) * 100}
            size="sm"
            tone={toneOf(part.tone ?? shown.tone)}
            trailing={shown.text}
            aria-label={field?.label ?? shown.text}
            className="min-w-0"
          />
        );
      }}
    />
  );
}

export const progressRenderer = noRenderers.define({
  kinds: ['number'],
  options: progressOptions,
  minWidth: 64,
  Component: ProgressRenderer,
});
