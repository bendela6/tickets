import { Button, DialogFooter } from '@bh/ui';

export function CancelAndSave() {
  return (
    <DialogFooter cancel={<Button variant="ghost">Cancel</Button>}>
      <Button variant="solid">Save</Button>
    </DialogFooter>
  );
}
