import { Button, DialogFooter } from '@bh/ui';

export function OneButton() {
  return (
    <div className="flex flex-col">
      <DialogFooter cancel={<Button variant="ghost">Close</Button>} />
      <DialogFooter>
        <Button variant="solid">Done</Button>
      </DialogFooter>
    </div>
  );
}
