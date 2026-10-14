import { Button, Icon, Kbd, Tooltip } from '@bh/ui';

export function InATooltip() {
  return (
    <Tooltip
      content={
        <span className="flex items-center gap-6">
          Copy <Kbd keys="mod+C" variant="tint" size="sm" />
        </span>
      }
    >
      <Button variant="ghost" aria-label="Copy" className="w-36 p-0">
        <Icon name="copy" />
      </Button>
    </Tooltip>
  );
}
