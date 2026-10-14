import { Button } from '@bh/ui';

export function ATooltip() {
  return (
    <div className="flex items-center gap-8">
      <Button label="Saves the draft and keeps it open">Save</Button>
      <Button variant="solid" label="Nothing has changed since the last save" disabled>
        Publish
      </Button>
    </div>
  );
}
