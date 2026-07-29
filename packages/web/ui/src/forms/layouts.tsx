import type { LayoutComponentProps } from '@tickets/form';
import { Card, CardBody, CardHeader, CardTitle } from '../components/card';
import { Row } from '../components/row';
import { Stack } from '../components/stack';

type TitledProps = { title?: string; description?: string };
type BareProps = Record<string, never>;

/** A titled panel. Card keeps `padding` at its 0 default so CardHeader's rule
 *  bleeds to both edges; CardBody supplies the content padding. */
export function CardLayout({ props, children }: LayoutComponentProps<TitledProps>) {
  const hasHeader = Boolean(props.title || props.description);
  return (
    <Card>
      {hasHeader ? (
        <CardHeader>
          <Stack gap={1}>
            {props.title ? <CardTitle>{props.title}</CardTitle> : null}
            {props.description ? (
              <span className="font-sans text-12/17 text-gray-11">{props.description}</span>
            ) : null}
          </Stack>
        </CardHeader>
      ) : null}
      <CardBody>
        <Stack gap={4}>{children}</Stack>
      </CardBody>
    </Card>
  );
}

/** A subdivision inside a panel: a rule, a caption, then the fields. Lighter
 *  than CardLayout — it draws no surface of its own. */
export function GroupLayout({ props, children }: LayoutComponentProps<TitledProps>) {
  const hasHeader = Boolean(props.title || props.description);
  return (
    <Stack gap={2}>
      {hasHeader ? (
        <Stack gap={1} className="border-t border-gray-6 pt-3">
          {props.title ? (
            <span className="font-sans text-13/19 font-600 text-gray-12">{props.title}</span>
          ) : null}
          {props.description ? (
            <span className="font-sans text-12/17 text-gray-11">{props.description}</span>
          ) : null}
        </Stack>
      ) : null}
      <Stack gap={4}>{children}</Stack>
    </Stack>
  );
}

/** Fields side by side. `align="start"` so a field with an error message does
 *  not drag its neighbours' controls downward as the message appears. */
export function RowLayout({ children }: LayoutComponentProps<BareProps>) {
  return (
    <Row gap={4} align="start">
      {children}
    </Row>
  );
}

/** Fields stacked. Same spacing as RootWrapper, so a nested column is
 *  indistinguishable from the top level — which is the point. */
export function ColumnLayout({ children }: LayoutComponentProps<BareProps>) {
  return <Stack gap={4}>{children}</Stack>;
}
