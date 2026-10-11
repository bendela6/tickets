import { Card } from '@bh/ui';

export function Radii() {
  return (
    <div className="flex flex-col gap-12">
      <Card radius="md" padding={3} className="w-320">
        <p className="text-13/19 text-gray-11">md</p>
      </Card>
      <Card radius="lg" padding={3} className="w-320">
        <p className="text-13/19 text-gray-11">lg</p>
      </Card>
      <Card radius="xl" padding={3} className="w-320">
        <p className="text-13/19 text-gray-11">xl</p>
      </Card>
    </div>
  );
}
