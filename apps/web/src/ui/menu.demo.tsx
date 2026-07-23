import { Button } from './button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from './menu';

function MenuFixture() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary">Row actions ▾</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem shortcut="E">Edit</MenuItem>
        <MenuItem shortcut="D">Duplicate</MenuItem>
        <MenuSeparator />
        <MenuItem destructive shortcut="⌫">
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export const meta = { title: 'Menu', group: 'Overlays' };

export const states = [{ name: 'row actions', render: () => <MenuFixture /> }];
