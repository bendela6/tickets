import { Button, Menu, MenuContent, MenuItem, MenuTrigger } from '@bh/ui';

export function IconTrigger() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" icon="ellipsis" label="More actions" />
      </MenuTrigger>
      <MenuContent>
        <MenuItem>Open</MenuItem>
        <MenuItem>Download</MenuItem>
        <MenuItem disabled>Move</MenuItem>
      </MenuContent>
    </Menu>
  );
}
