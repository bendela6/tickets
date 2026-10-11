import { Progress } from '@bh/ui';

export function Figures() {
  return (
    <div className="flex w-192 flex-col gap-12">
      <Progress value={40} label="2/5" aria-label="Files uploaded" />
      <Progress value={90} tone="danger" trailing="90%" aria-label="Storage used" />
    </div>
  );
}
