import type { LayoutComponentProps } from '@tickets/form';
import { Card, CardBody, CardHeader } from '../components/card';
import { Row } from '../components/row';
import { Stack } from '../components/stack';

/**
 * TODO: move all those layout components to separate folder with individual files
 * card-layout.tsx
 * group-layout.tsx
 * row-layout.tsx
 * column-layout.tsx
 * index.ts for barrel exports
 * */

type TitledProps = { title?: string; description?: string };
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
  if (!title && !description) return null;
  return (
    <Stack gap={1} className={className}>
      {title ? (
        <Heading className="font-sans text-13/19 font-600 text-gray-12">{title}</Heading>
      ) : null}
      {description ? (
        <span className="font-sans text-12/17 text-gray-11">{description}</span>
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
        className="flex-col @form-columns:flex-row @form-columns:[&>*]:min-w-0 @form-columns:[&>*]:flex-1"
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
