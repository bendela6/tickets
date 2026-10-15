import { Button, FilterChanges } from '@bh/ui';

export function AChangeWaiting() {
  return (
    <div className="flex items-center gap-8">
      <FilterChanges count={1} />
      <Button variant="ghost" size="sm">
        Clear
      </Button>
      <Button variant="solid" size="sm">
        Apply
      </Button>
    </div>
  );
}
