import { Card, CardBody, CardHeader, CardState, CardTitle, Icon } from '@bh/ui';

export function APartialAnswer() {
  return (
    <Card className="w-320">
      <CardHeader>
        <CardTitle>Uploads</CardTitle>
      </CardHeader>
      <CardBody>
        <CardState gap={3}>
          <p className="text-13/19 text-gray-11">3 files uploading, 12 MB left.</p>
          <p role="status" className="text-12/17 text-orange-11 flex items-start gap-6">
            <Icon name="triangle-alert" size="sm" className="mt-2 shrink-0" />
            <span>The mirror did not answer: its speeds are missing.</span>
          </p>
        </CardState>
      </CardBody>
    </Card>
  );
}
