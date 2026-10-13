import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, test, vi } from 'vitest';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from './menu';

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

// A submenu opens beside its row by pointer or by keys, and closes back to it.
describe('a submenu', () => {
  const onRed = vi.fn();
  const renderMenu = () => {
    render(
      <Menu>
        <MenuTrigger>Format</MenuTrigger>
        <MenuContent>
          <MenuItem>Bold</MenuItem>
          <MenuSub>
            <MenuSubTrigger>Text colour</MenuSubTrigger>
            <MenuSubContent>
              <MenuItem onSelect={onRed}>Red</MenuItem>
              <MenuItem>Blue</MenuItem>
            </MenuSubContent>
          </MenuSub>
        </MenuContent>
      </Menu>,
    );
  };
  const row = () => screen.getByRole('menuitem', { name: 'Text colour' });

  // From the trigger, by keys: Enter opens the menu on its first item, ↓ moves to the row.
  const toTheRow = async (user: ReturnType<typeof userEvent.setup>) => {
    screen.getByRole('button', { name: 'Format' }).focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}');
    expect(row()).toHaveFocus();
  };

  it('opens on hover, its row lit while it is open', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'Format' }));
    expect(screen.queryByRole('menuitem', { name: 'Red' })).toBeNull();
    await user.hover(row());
    expect(await screen.findByRole('menuitem', { name: 'Red' })).toBeInTheDocument();
    expect(row()).toHaveAttribute('aria-expanded', 'true');
    expect(row()).toHaveAttribute('data-state', 'open');
  });

  it.each([['{ArrowRight}'], ['{Enter}'], [' ']])('opens on %s, on its first item', async (key) => {
    const user = userEvent.setup();
    renderMenu();
    await toTheRow(user);
    await user.keyboard(key);
    expect(await screen.findByRole('menuitem', { name: 'Red' })).toHaveFocus();
  });

  it('closes on ←, back to its row', async () => {
    const user = userEvent.setup();
    renderMenu();
    await toTheRow(user);
    await user.keyboard('{ArrowRight}');
    expect(await screen.findByRole('menuitem', { name: 'Red' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.queryByRole('menuitem', { name: 'Red' })).toBeNull();
    expect(row()).toHaveFocus();
    expect(row()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape, with the menu, back to the menu’s trigger', async () => {
    const user = userEvent.setup();
    renderMenu();
    await toTheRow(user);
    await user.keyboard('{ArrowRight}');
    expect(await screen.findByRole('menuitem', { name: 'Red' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'Format' })).toHaveFocus();
  });

  it('runs a chosen item and closes the whole menu', async () => {
    const user = userEvent.setup();
    onRed.mockClear();
    renderMenu();
    await toTheRow(user);
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');
    expect(onRed).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens nothing from a disabled row, and the keys pass over it', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <MenuTrigger>Format</MenuTrigger>
        <MenuContent>
          <MenuItem>Bold</MenuItem>
          <MenuSub>
            <MenuSubTrigger disabled>Highlight</MenuSubTrigger>
            <MenuSubContent>
              <MenuItem>Yellow</MenuItem>
            </MenuSubContent>
          </MenuSub>
          <MenuItem>Italic</MenuItem>
        </MenuContent>
      </Menu>,
    );
    screen.getByRole('button', { name: 'Format' }).focus();
    await user.keyboard('{Enter}');
    const highlight = screen.getByRole('menuitem', { name: 'Highlight' });
    expect(highlight).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Italic' })).toHaveFocus();
    await user.hover(highlight);
    await user.keyboard('{ArrowRight}');
    expect(screen.queryByRole('menuitem', { name: 'Yellow' })).toBeNull();
  });
});
