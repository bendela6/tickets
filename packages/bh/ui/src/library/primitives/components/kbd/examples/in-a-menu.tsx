import { useState } from 'react';
import { Button, Kbd, Menu, MenuContent, MenuItem, MenuTrigger } from '@bh/ui';

export function InAMenu() {
  const [chosen, setChosen] = useState('nothing yet');
  return (
    <div className="flex items-center gap-12">
      <Menu>
        <MenuTrigger asChild>
          <Button chevron>Edit</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            shortcut={<Kbd keys="mod+Z" variant="text" />}
            onSelect={() => setChosen('Undo')}
          >
            Undo
          </MenuItem>
          <MenuItem
            shortcut={<Kbd keys="mod+shift+Z" variant="text" />}
            onSelect={() => setChosen('Redo')}
          >
            Redo
          </MenuItem>
          <MenuItem
            shortcut={<Kbd keys="mod+A" variant="text" />}
            onSelect={() => setChosen('Select all')}
          >
            Select all
          </MenuItem>
        </MenuContent>
      </Menu>
      <span className="text-13 text-gray-11">Chose {chosen}</span>
    </div>
  );
}
