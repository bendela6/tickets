import { useState } from 'react';
import { Button, Menu, MenuContent, MenuItem, MenuTrigger } from '@bh/ui';

export function Shortcuts() {
  const [chosen, setChosen] = useState('nothing yet');
  return (
    <div className="flex items-center gap-12">
      <Menu>
        <MenuTrigger asChild>
          <Button chevron>Edit</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem shortcut="⌘X" onSelect={() => setChosen('Cut')}>
            Cut
          </MenuItem>
          <MenuItem shortcut="⌘C" onSelect={() => setChosen('Copy')}>
            Copy
          </MenuItem>
          <MenuItem shortcut="⌘V" onSelect={() => setChosen('Paste')}>
            Paste
          </MenuItem>
        </MenuContent>
      </Menu>
      <span className="text-13 text-gray-11">Chose {chosen}</span>
    </div>
  );
}
