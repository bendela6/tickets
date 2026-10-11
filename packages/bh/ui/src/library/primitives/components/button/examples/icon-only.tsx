import { Button, Icon } from '@bh/ui';

export function IconOnly() {
  return (
    <Button variant="ghost" aria-label="More actions" className="w-36 p-0">
      <Icon name="ellipsis" />
    </Button>
  );
}
