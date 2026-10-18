import * as v from 'valibot';
import { cn } from '../../../style';
import { Row } from '../../layout/components/row';
import { defineTemplateLayout, type TemplateLayoutProps } from '../layout-registry';
import { gap } from './options';
import { placed } from './placed';

/** Row's options; repeat takes them too. */
export const rowEntries = {
  /** Along the row. Default `start`. */
  justify: v.optional(v.picklist(['start', 'center', 'end', 'between'])),
  /** Across the row. Default `center`. */
  align: v.optional(v.picklist(['start', 'center', 'end', 'stretch', 'baseline'])),
  /** Space between nodes. Default `0`. */
  gap: v.optional(gap),
  /** Wraps nodes that don't fit. Default `false`. */
  wrap: v.optional(v.boolean()),
};

const rowOptions = v.strictObject(rowEntries);

export type RowOptions = v.InferOutput<typeof rowOptions>;

/** Its items side by side. */
export function TemplateRowLayout({ options, items }: TemplateLayoutProps<RowOptions>) {
  const { justify, align = 'center', gap = 0, wrap } = options;
  return (
    <Row gap={gap} align={align} justify={justify} className={cn('min-w-0', wrap && 'flex-wrap')}>
      {placed(items)}
    </Row>
  );
}

export const rowLayout = defineTemplateLayout({
  options: rowOptions,
  Component: TemplateRowLayout,
});
