import { Button } from '@bh/ui';

export function Loading() {
  return (
    <div className="flex gap-8">
      <Button loading>Saving</Button>
      <Button variant="outline" loading>
        Uploading
      </Button>
    </div>
  );
}
