import * as v from 'valibot';
import { defineTemplateLayout, type TemplateLayoutProps } from '../layout-registry';
import { count } from './options';
import { rowEntries, TemplateRowLayout } from './row';

const repeatOptions = v.strictObject({
  ...rowEntries,
  /** The list field: a many field, or a json list. */
  field: v.pipe(v.string(), v.nonEmpty()),
  /** The most entries drawn; the rest show as "+N". Default all. */
  max: v.optional(count),
});

export type RepeatOptions = v.InferOutput<typeof repeatOptions>;

/** Its items once per entry of a list field, in a row, then "+N" past `max`. */
export function TemplateRepeatLayout({ options, items, more }: TemplateLayoutProps<RepeatOptions>) {
  const counted =
    more > 0 ? (
      <span className="text-gray-11 tabular-nums">
        +{more}
        <span className="sr-only"> more</span>
      </span>
    ) : null;
  return (
    <TemplateRowLayout options={options} items={counted ? [...items, counted] : items} more={0} />
  );
}

export const repeatLayout = defineTemplateLayout({
  options: repeatOptions,
  repeats: ({ field, max }) => {
    return max === undefined ? { field } : { field, max };
  },
  Component: TemplateRepeatLayout,
});
