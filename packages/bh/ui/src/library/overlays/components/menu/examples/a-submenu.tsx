import { useState } from 'react';
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from '@bh/ui';

const COLOURS = ['Accent', 'Danger', 'Warning', 'Success', 'Default'];

export function ASubmenu() {
  const [chosen, setChosen] = useState('nothing yet');
  return (
    <div className="flex items-center gap-12">
      <Menu>
        <MenuTrigger asChild>
          <Button chevron>Format</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => setChosen('Bold')}>Bold</MenuItem>
          <MenuItem onSelect={() => setChosen('Italic')}>Italic</MenuItem>
          <MenuSeparator />
          <MenuSub>
            <MenuSubTrigger>Text colour</MenuSubTrigger>
            <MenuSubContent>
              {COLOURS.map((colour) => {
                return (
                  <MenuItem key={colour} onSelect={() => setChosen(colour)}>
                    {colour}
                  </MenuItem>
                );
              })}
            </MenuSubContent>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger disabled>Highlight</MenuSubTrigger>
            <MenuSubContent>
              <MenuItem>Yellow</MenuItem>
            </MenuSubContent>
          </MenuSub>
        </MenuContent>
      </Menu>
      <span className="text-13 text-gray-11">Chose {chosen}</span>
    </div>
  );
}
