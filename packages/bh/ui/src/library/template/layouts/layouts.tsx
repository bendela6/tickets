import { Fragment, type ReactNode } from 'react';
import type { BaseLayouts, LayoutProps } from '@bh/template';
import { cn } from '../../../style';
import { Row } from '../../layout/components/row';
import { ALIGN, GAP, Stack } from '../../layout/components/stack';

// bh's three template layouts, drawn with the library's Row and Stack where
// they fit: each lays out the items it's given, its nodes already drawn, and
// applies its options' defaults. Each is in `baseTemplateLayouts` with its
// spec from @bh/template.

type Props<K extends keyof BaseLayouts> = LayoutProps<BaseLayouts[K], ReactNode>;

const JUSTIFY = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

/** The items, each in its place, keyed by its place: their order is the template's. */
function placed(items: readonly ReactNode[]) {
  return items.map((item, index) => {
    return <Fragment key={index}>{item}</Fragment>;
  });
}

/**
 * Its items side by side or one under another: a row, two sides, a stack. A
 * row, packed at its start and centered across, with no gap, when its options
 * say nothing; a column stretches its items across.
 */
export function FlexLayout({ options, items }: Props<'flex'>) {
  const { direction = 'row', justify, align, gap = 0, wrap } = options;
  if (direction === 'row') {
    return (
      <Row
        gap={gap}
        align={align ?? 'center'}
        justify={justify}
        className={cn('min-w-0', wrap && 'flex-wrap')}
      >
        {placed(items)}
      </Row>
    );
  }
  return (
    <Stack
      gap={gap}
      // A column's items have no baseline to share: they line up at the start.
      align={align === 'baseline' ? 'start' : align}
      className={cn('min-w-0', justify && JUSTIFY[justify], wrap && 'flex-wrap')}
    >
      {placed(items)}
    </Stack>
  );
}

/**
 * Its items in columns, row after row: a fixed count of equal ones, or as
 * many as fit at their least width, each stretched across its cell unless
 * its options say otherwise.
 */
export function GridLayout({ options, items }: Props<'grid'>) {
  const { columns, gap = 0, align = 'stretch' } = options;
  // A count, or a least width, is the template's number: no class spells
  // every one, so the tracks are the element's own style.
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

/**
 * One item per entry of its list field, laid out as flex lays out its items,
 * then the entries past its `max` counted: "+3".
 */
export function RepeatLayout({ options, items, more }: Props<'repeat'>) {
  const counted =
    more > 0 ? (
      <span className="text-gray-11 tabular-nums">
        +{more}
        <span className="sr-only"> more</span>
      </span>
    ) : null;
  return <FlexLayout options={options} items={counted ? [...items, counted] : items} more={0} />;
}
