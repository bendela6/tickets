import { Button } from '@bh/ui';

export function Sizes() {
  return (
    <div className="flex items-center gap-8">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  );
}
