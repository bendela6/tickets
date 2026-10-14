import { Card } from '@bh/ui';

export function LinkCard() {
  return (
    <Card asChild interactive padding={4} className="w-320">
      <a href="#">
        <p className="text-13/19 font-600 text-gray-12">Annual report</p>
        <p className="text-12/17 text-gray-11">report.pdf, 2.4 MB</p>
      </a>
    </Card>
  );
}
