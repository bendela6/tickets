import { Button, Notice, Stack } from '@bh/ui';

export function WithAnAction() {
  return (
    <Stack gap={3}>
      <Notice
        tone="danger"
        title="Could not load the builds"
        action={
          <Button size="sm" variant="outline" tone="danger">
            Try again
          </Button>
        }
      >
        The server did not answer in 30 seconds.
      </Notice>
      <Notice
        tone="primary"
        action={
          <>
            <Button size="sm" variant="solid">
              Reload
            </Button>
            <Button size="sm" variant="ghost" tone="neutral">
              Later
            </Button>
          </>
        }
      >
        A new version of this page is ready. Reload to use it; nothing you typed is lost.
      </Notice>
    </Stack>
  );
}
