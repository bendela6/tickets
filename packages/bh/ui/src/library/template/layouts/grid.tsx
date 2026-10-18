import * as v from 'valibot';
import { cn } from '../../../style';
import { ALIGN, GAP } from '../../layout/components/stack';
import { noTemplateLayouts, type TemplateLayoutProps } from '../layout-registry';
import { count, gap } from './options';
import { placed } from './placed';

const gridOptions = v.strictObject({
  /** A count (`2`), or as many as fit at a least width (`{ min: 160 }`). */
  columns: v.union([count, v.strictObject({ min: count })]),
  /** Space between rows and columns. Default `0`. */
  gap: v.optional(gap),
  /** Each node in its cell. Default `stretch`. */
  align: v.optional(v.picklist(['start', 'center', 'end', 'stretch'])),
});

export type GridOptions = v.InferOutput<typeof gridOptions>;

/** Its items in columns. */
export function TemplateGridLayout({ options, items }: TemplateLayoutProps<GridOptions>) {
  const { columns, gap = 0, align = 'stretch' } = options;
  // A count, or as many as fit: no class spells every one.
  const tracks =
    typeof columns === 'number'
      ? `repeat(${columns}, minmax(0, 1fr))`
      : `repeat(auto-fill, minmax(min(100%, ${columns.min}px), 1fr))`;
  return (
    <div
      className={cn('grid min-w-0', GAP[gap], ALIGN[align])}
      style={{ gridTemplateColumns: tracks }}
    >
      {placed(items)}
    </div>
  );
}

export const gridLayout = noTemplateLayouts.define({
  options: gridOptions,
  Component: TemplateGridLayout,
});
