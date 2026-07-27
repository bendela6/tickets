import { definePlayground, text, boolean } from '../../gallery';
import { Button } from '../button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from './menu';

function MenuFixture() {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="outline" chevron>Row actions</Button>
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

function MenuPlaygroundFixture({ shortcut, destructive }: { shortcut: string; destructive: boolean }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="outline" chevron>Row actions</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem shortcut="E">Edit</MenuItem>
        <MenuItem shortcut="D">Duplicate</MenuItem>
        <MenuSeparator />
        <MenuItem destructive={destructive} shortcut={shortcut}>
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export const meta = { title: 'Menu', group: 'Components', size: 'sm' };

export const states = [{ name: 'row actions', render: () => <MenuFixture /> }];

export const playground = definePlayground({
  controls: {
    shortcut: text('E'),
    destructive: boolean(true),
  },
  render: (v) => <MenuPlaygroundFixture {...v} />,
});
