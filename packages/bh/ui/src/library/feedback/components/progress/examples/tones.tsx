import { Progress } from '@bh/ui';

export function Tones() {
  return (
    <div className="flex w-160 flex-col gap-12">
      <Progress value={78} tone="primary" aria-label="Primary" />
      <Progress value={78} tone="success" aria-label="Success" />
      <Progress value={78} tone="warning" aria-label="Warning" />
      <Progress value={78} tone="danger" aria-label="Danger" />
    </div>
  );
}
