import { Button } from './button';
import { useToast } from './toast';

function ToastFixture() {
  const { toast } = useToast();
  return (
    <Button
      variant="secondary"
      onClick={() =>
        toast({ title: 'View saved', action: { label: 'Undo', onClick: () => undefined } })
      }
    >
      Fire toast
    </Button>
  );
}

export const meta = { title: 'Toast', group: 'Overlays' };

export const states = [{ name: 'fire toast', render: () => <ToastFixture /> }];
