import { Button, DialogFooter } from '@bh/ui';

export function HintBeforeButtons() {
  return (
    <div className="border-gray-6 mt-16 flex items-center gap-8 border-t-1 pt-16">
      <span className="text-13 text-gray-11 flex-1">3 files selected</span>
      <DialogFooter
        className="mt-0 border-t-0 p-0"
        cancel={<Button variant="ghost">Cancel</Button>}
      >
        <Button variant="solid">Move</Button>
      </DialogFooter>
    </div>
  );
}
