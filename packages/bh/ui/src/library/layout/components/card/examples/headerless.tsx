import { Card } from '@bh/ui';

export function Headerless() {
  return (
    <Card padding={4} className="w-320">
      <p className="text-13/19 text-gray-11">A card with no header sets its own padding.</p>
    </Card>
  );
}
