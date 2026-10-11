import { Progress } from '@bh/ui';

export function Sizes() {
  return (
    <div className="flex w-160 flex-col gap-12">
      <Progress value={62} size="sm" aria-label="Small" />
      <Progress value={62} size="md" aria-label="Medium" />
      <Progress value={62} size="lg" aria-label="Large" />
    </div>
  );
}
