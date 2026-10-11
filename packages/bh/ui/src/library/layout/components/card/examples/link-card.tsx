import { Card } from '@bh/ui';

export function LinkCard() {
  return (
    <a href="#" className="rounded-12 block w-320">
      <Card interactive padding={4}>
        <p className="text-13/19 font-600 text-gray-12">Annual report</p>
        <p className="text-12/17 text-gray-11">report.pdf, 2.4 MB</p>
      </Card>
    </a>
  );
}
