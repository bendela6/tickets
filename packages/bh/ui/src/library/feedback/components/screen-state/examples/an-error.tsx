import { Button, ScreenState } from '@bh/ui';

export function AnError() {
  return (
    <ScreenState
      tone="danger"
      icon="triangle-alert"
      title="Couldn't load the files"
      body="The server isn't responding. Check your connection, then try again."
      action={<Button variant="outline">Retry</Button>}
    />
  );
}
