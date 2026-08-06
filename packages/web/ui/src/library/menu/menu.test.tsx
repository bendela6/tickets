import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from './menu';

test('opens on trigger and fires the chosen item', async () => {
  const onSelect = vi.fn();
  render(
    <Menu>
      <MenuTrigger>Actions</MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={onSelect} shortcut="⌘C">
          Copy key
        </MenuItem>
        <MenuSeparator />
        <MenuItem destructive>Archive</MenuItem>
      </MenuContent>
    </Menu>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: /copy key/i }));
  expect(onSelect).toHaveBeenCalledOnce();
});
