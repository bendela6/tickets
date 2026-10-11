import { Button, Icon, Menu, MenuContent, MenuItem, MenuTrigger } from '@bh/ui';

export function IconTrigger() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" aria-label="More actions" className="w-36 p-0">
          <Icon name="ellipsis" />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem>Open</MenuItem>
        <MenuItem>Download</MenuItem>
        <MenuItem disabled>Move</MenuItem>
      </MenuContent>
    </Menu>
  );
}
