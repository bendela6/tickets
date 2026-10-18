import * as v from 'valibot';
import { Stack } from '../../layout/components/stack';
import { noTemplateLayouts, type TemplateLayoutProps } from '../layout-registry';
import { gap } from './options';
import { placed } from './placed';

const stackOptions = v.strictObject({
  /** Across the stack. Default `stretch`. */
  align: v.optional(v.picklist(['start', 'center', 'end', 'stretch'])),
  /** Space between nodes. Default `0`. */
  gap: v.optional(gap),
});

export type StackOptions = v.InferOutput<typeof stackOptions>;

/** Its items one under another. */
export function TemplateStackLayout({ options, items }: TemplateLayoutProps<StackOptions>) {
  const { align, gap = 0 } = options;
  return (
    <Stack gap={gap} align={align} className="min-w-0">
      {placed(items)}
    </Stack>
  );
}

export const stackLayout = noTemplateLayouts.define({
  options: stackOptions,
  Component: TemplateStackLayout,
});
