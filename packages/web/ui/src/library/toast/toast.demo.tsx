import { definePlayground, text } from '../../gallery';
import { Button } from '../button';
import { useToast } from './toast';

function ToastFixture() {
  const { toast } = useToast();
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast({ title: 'View saved', action: { label: 'Undo', onClick: () => undefined } })
      }
    >
      Fire toast
    </Button>
  );
}

function ToastPlaygroundFixture({ title, actionLabel }: { title: string; actionLabel: string }) {
  const { toast } = useToast();
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast({ title, action: { label: actionLabel, onClick: () => undefined } })
      }
    >
      Fire toast
    </Button>
  );
}

export const meta = { title: 'Toast', group: 'Components', size: 'sm' };

export const states = [{ name: 'fire toast', render: () => <ToastFixture /> }];

export const playground = definePlayground({
  controls: {
    title: text('View saved'),
    actionLabel: text('Undo'),
  },
  render: (v) => <ToastPlaygroundFixture {...v} />,
});
