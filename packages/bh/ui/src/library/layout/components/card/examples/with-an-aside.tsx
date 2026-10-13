import { Card, CardBody, CardHeader, CardTitle } from '@bh/ui';

export function WithAnAside() {
  return (
    <div className="flex w-320 flex-col gap-12">
      <Card>
        <CardHeader aside="4 cores · up 3 d 4 h">
          <CardTitle>Machine</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-13/19 text-gray-11">The aside is small grey type by default.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          aside={
            <>
              12 of 14 running ·{' '}
              <a href="#all" className="text-gray-12 underline-offset-2 hover:underline">
                See all
              </a>
            </>
          }
        >
          <CardTitle>Services</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-13/19 text-gray-11">Words and a link keep their spaces.</p>
        </CardBody>
      </Card>
    </div>
  );
}
