import type { LayoutComponentProps } from '@bh/form';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../style';
import { Card, CardBody, CardHeader } from '../layout/components/card';
import { Row } from '../layout/components/row';
import { Stack } from '../layout/components/stack';
import { InlineRowContext } from './inline-row';

/**
 * TODO: move all those layout components to separate folder with individual files
 * card-layout.tsx
 * group-layout.tsx
 * row-layout.tsx
 * column-layout.tsx
 * index.ts for barrel exports
 * */

interface TitledProps {
  title?: string;
  description?: string;
}
type BareProps = Record<string, never>;

/** Shared header block for the two titled layouts. Returns null when there
 *  is nothing to show, so callers need no `hasHeader` of their own.
 *
 *  Called as a plain function rather than JSX — it has no hooks, and callers
 *  need its return value itself (null or not) to decide whether to render
 *  their own wrapping chrome (CardHeader, the group's top rule). */
function LayoutHeader({
  title,
  description,
  as: Heading = 'h3',
  className,
}: TitledProps & { as?: 'h3' | 'h4'; className?: string }) {
  if (!title && !description) {
    return null;
  }
  return (
    <Stack gap={1} className={className}>
      {title ? (
        <Heading className="text-13/19 font-600 text-gray-12 font-sans">{title}</Heading>
      ) : null}
      {description ? (
        <span className="text-12/17 text-gray-11 font-sans">{description}</span>
      ) : null}
    </Stack>
  );
}

/** A titled panel. Card keeps `padding` at its 0 default so CardHeader's rule
 *  bleeds to both edges; CardBody supplies the content padding.
 *
 *  Renders its title through LayoutHeader rather than CardTitle: the two
 *  layouts share one header implementation instead of CardTitle's class list
 *  being hand-copied into GroupLayout, where it would silently diverge the
 *  first time CardTitle is restyled. CardTitle stays exported from Card for
 *  callers that want a card header without the rest of this layout. */
export function CardLayout({ props, children }: LayoutComponentProps<TitledProps>) {
  const header = LayoutHeader({ title: props.title, description: props.description });
  return (
    <Card>
      {header ? <CardHeader>{header}</CardHeader> : null}
      <CardBody>
        <Stack gap={4}>{children}</Stack>
      </CardBody>
    </Card>
  );
}

/** A subdivision inside a panel: a rule, a caption, then the fields. Lighter
 *  than CardLayout — it draws no surface of its own. Its heading is one level
 *  deeper than CardLayout's (`h4` vs `h3`) since a group nests inside a card
 *  in the document outline. */
export function GroupLayout({ props, children }: LayoutComponentProps<TitledProps>) {
  const header = LayoutHeader({
    title: props.title,
    description: props.description,
    as: 'h4',
    className: 'border-t-1 border-gray-6 pt-12',
  });
  return (
    <Stack gap={2}>
      {header}
      <Stack gap={4}>{children}</Stack>
    </Stack>
  );
}

/** Fields side by side — but **only once the form is wide enough to hold them**
 *  (design file 20: two columns past ~760px, "otherwise the pairs are too
 *  narrow to hold a date beside a duration"). Below that the row stacks, so a
 *  form declaring `row` gets a sensible narrow layout for free rather than two
 *  cramped columns.
 *
 *  Measured against the form's container, not the viewport, so a paired row in
 *  a drawer stacks however wide the monitor is. `align="start"` so a field with
 *  an error message does not drag its neighbours' controls downward as the
 *  message appears.
 *
 *  `[&>*]:flex-1` gives the children equal widths only when side by side —
 *  stacked, `flex-col` makes it a no-op on the main axis. Without it a short
 *  field and a long one split the row by content width, which is not what a
 *  two-column form means. */
export function RowLayout({ children }: LayoutComponentProps<BareProps>) {
  return (
    // The outer div establishes the container the Row queries — an element
    // cannot query the container it establishes. Measuring its own box rather
    // than the form root's is deliberate: a row nested inside another layout
    // has whatever width that layout left it, and `root` is optional in the
    // registry, so reading from the top would fail silently for any consumer
    // that omits it.
    <div className="@container">
      <Row
        gap={4}
        align="start"
        className="@form-columns:flex-row @form-columns:[&>*]:min-w-0 @form-columns:[&>*]:flex-1 flex-col"
      >
        {children}
      </Row>
    </div>
  );
}

/** Fields stacked. Same spacing as RootWrapper, so a nested column is
 *  indistinguishable from the top level — which is the point. */
export function ColumnLayout({ children }: LayoutComponentProps<BareProps>) {
  return <Stack gap={4}>{children}</Stack>;
}

/** The form's buttons, side by side at their own widths, a little apart from
 *  the fields above. Unlike `row` it never stacks or stretches: a button's
 *  width is its label's. */
export function ActionsLayout({ children }: LayoutComponentProps<BareProps>) {
  return (
    // `data-actions`: a filter sheet keeps a form's buttons at its foot by it.
    <Row gap={2} data-actions="" className="mt-8 flex-wrap">
      {children}
    </Row>
  );
}

/**
 * How an `inline` row holds more than fits on one line: `wrap` onto more
 * lines; `scroll`, one line that scrolls sideways, fading at the end while
 * there is more; or `{ collapse: n }`, a `rules` field's first `n` chips and
 * a "+3 more" button that shows the rest.
 */
export type InlineOverflow = 'wrap' | 'scroll' | { collapse: number };

export interface InlineLayoutProps {
  /** More than fits: `wrap` (the default), `scroll` or `{ collapse: n }`. */
  overflow?: InlineOverflow;
  /**
   * Below `below` pixels of the filter form's own width, only the fields
   * named in `keep` stay in the row and the rest move to a sheet. A filter
   * form reads it; the row itself doesn't.
   */
  narrow?: { below: number; keep: string[] };
}

// `inline-row`: its count, its changes and its buttons sit at its end, by it.
const ROW = 'inline-row flex min-w-0 items-center gap-6';

// The last 56 pixels of a row that scrolls fade out while there is more past them.
const FADE = 'linear-gradient(to right, black calc(100% - 56px), transparent)';

/** One line that scrolls sideways, fading at its end while there is more to see. */
function ScrollingRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const row = ref.current;
    if (!row) {
      return undefined;
    }
    const measure = () => {
      setMore(row.scrollLeft + row.clientWidth < row.scrollWidth - 1);
    };
    measure();
    row.addEventListener('scroll', measure, { passive: true });
    // The row's own size, and its fields', which change what there is to scroll.
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(row);
    for (const child of Array.from(row.children)) {
      observer?.observe(child);
    }
    return () => {
      row.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, []);
  return (
    <div
      ref={ref}
      data-overflow="scroll"
      // Whether there is more past the end, which fades out.
      data-more={more || undefined}
      // Room above and below for a focus ring, which a scrolling box clips.
      className={cn(ROW, '-my-4 flex-nowrap overflow-x-auto py-4 *:shrink-0')}
      style={more ? { maskImage: FADE } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Fields side by side in one row, each at its own width and named by
 * `InlineFieldWrapper`, as a filter bar lays them out: 6 pixels apart and
 * centred on the row. A filter's count and changes and the form's buttons
 * sit at its end, past the free space, and a reset with nothing to reset
 * isn't drawn. More than fits wraps onto more lines, scrolls sideways, or
 * collapses a `rules` field's chips, as `overflow` says.
 */
export function InlineLayout({ props, children }: LayoutComponentProps<InlineLayoutProps>) {
  const overflow = props.overflow ?? 'wrap';
  if (overflow === 'scroll') {
    return <ScrollingRow>{children}</ScrollingRow>;
  }
  const collapse = typeof overflow === 'object' ? overflow.collapse : undefined;
  return (
    <InlineRowContext value={collapse === undefined ? {} : { collapse }}>
      <div className={cn(ROW, 'flex-wrap')}>{children}</div>
    </InlineRowContext>
  );
}
