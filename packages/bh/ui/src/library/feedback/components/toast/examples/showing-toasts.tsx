import { Button, ToastProvider, useToast } from '@bh/ui';

function SaveButton() {
  const { toast } = useToast();
  return <Button onClick={() => toast({ title: 'File saved' })}>Save</Button>;
}

export function ShowingToasts() {
  return (
    <ToastProvider>
      <SaveButton />
    </ToastProvider>
  );
}
