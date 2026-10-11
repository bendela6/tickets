import { Card, CardBody, CardHeader, CardTitle } from '@bh/ui';

export function WithHeader() {
  return (
    <Card className="w-320">
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-13/19 text-gray-11">
          The card keeps no padding, so the header's rule reaches both edges.
        </p>
      </CardBody>
    </Card>
  );
}
