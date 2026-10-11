import { Button, useCopy } from '@bh/ui';

function labelFor(copied: boolean, failed: boolean) {
  if (copied) {
    return 'Copied';
  }
  return failed ? 'Could not copy' : 'Copy the city';
}

export function WithoutTheButton() {
  const { copy, copied, failed } = useCopy();
  return (
    <Button variant="subtle" onClick={() => void copy('Lisbon')}>
      {labelFor(copied, failed)}
    </Button>
  );
}
