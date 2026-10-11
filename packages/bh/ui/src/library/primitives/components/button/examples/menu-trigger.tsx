import { Button, Menu, MenuContent, MenuItem, MenuTrigger } from '@bh/ui';

export function OpeningAMenu() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button chevron>Sort</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem>Newest first</MenuItem>
        <MenuItem>Oldest first</MenuItem>
        <MenuItem>By name</MenuItem>
      </MenuContent>
    </Menu>
  );
}
