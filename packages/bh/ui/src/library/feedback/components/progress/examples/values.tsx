import { Progress } from '@bh/ui';

export function Values() {
  return (
    <div className="flex w-160 flex-col gap-12">
      <Progress value={0} aria-label="Not started" />
      <Progress value={42} aria-label="Under way" />
      <Progress value={100} aria-label="Done" />
      <Progress value={140} aria-label="Over the top" />
    </div>
  );
}
