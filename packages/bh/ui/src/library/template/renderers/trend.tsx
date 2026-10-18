import * as v from 'valibot';
import type { RendererProps } from '@bh/template';
import { cn } from '../../../style';
import { Icon } from '../../primitives/components/icon';
import { defineRenderer } from '../renderer-registry';
import { Each, numberOf } from './each';
import { partLook } from './look';

const trendOptions = v.strictObject({
  /** The good way: `up` or `down`. Default `up`. */
  good: v.optional(v.picklist(['up', 'down'])),
});

export type TrendOptions = v.InferOutput<typeof trendOptions>;

/** A change, with an arrow, green the good way. */
export function TrendRenderer({ values, options, part }: RendererProps<TrendOptions>) {
  return (
    <Each
      values={values}
      draw={(shown) => {
        const value = numberOf(shown) ?? 0;
        const way = value > 0 ? 'up' : value < 0 ? 'down' : undefined;
        const good = way === (options.good ?? 'up') ? 'success' : 'danger';
        const look = partLook(part, way === undefined ? undefined : good);
        return (
          <span
            className={cn('inline-flex items-center gap-2 tabular-nums', look.className)}
            style={look.style}
          >
            {way === undefined ? null : <Icon name={`arrow-${way}`} size="xs" />}
            {part.prefix}
            {shown.text}
          </span>
        );
      }}
    />
  );
}

export const trendRenderer = defineRenderer({
  kinds: ['number'],
  options: trendOptions,
  minWidth: 40,
  Component: TrendRenderer,
});
