import { Button, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@bh/ui';

export function Destructive() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button chevron>File</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem>Rename</MenuItem>
        <MenuItem>Duplicate</MenuItem>
        <MenuSeparator />
        <MenuItem destructive>Delete</MenuItem>
      </MenuContent>
    </Menu>
  );
}
