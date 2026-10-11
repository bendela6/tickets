import { Button, Icon, Tooltip } from '@bh/ui';

export function IconButtons() {
  return (
    <div className="flex gap-4">
      <Tooltip content="Copy, ⌘C">
        <Button variant="ghost" aria-label="Copy" className="w-36 p-0">
          <Icon name="copy" />
        </Button>
      </Tooltip>
      <Tooltip content="Rename">
        <Button variant="ghost" aria-label="Rename" className="w-36 p-0">
          <Icon name="pencil" />
        </Button>
      </Tooltip>
      <Tooltip content="Delete">
        <Button variant="ghost" aria-label="Delete" className="w-36 p-0">
          <Icon name="trash" />
        </Button>
      </Tooltip>
    </div>
  );
}
