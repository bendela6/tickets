import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../app';

const setup = () => {
  const user = userEvent.setup();
  render(<App />);
  return { user };
};

const openManager = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'States' }));
  return screen.getByRole('list', { name: 'States' });
};

/** default, state 2, state 3 — appended in that order, unlike the object rail. */
const addTwoMore = async (user: ReturnType<typeof userEvent.setup>) => {
  const list = await openManager(user);
  const add = within(list.parentElement!).getByRole('button', { name: '+ add state' });
  await user.click(add);
  await user.click(add);
  return list;
};

const rowNames = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((row) => row.textContent);

describe('reordering states from the keyboard', () => {
  it('moves a row up a place with Alt+ArrowUp', async () => {
    const { user } = setup();
    const list = await addTwoMore(user);
    within(list).getByRole('button', { name: 'state 2' }).focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(rowNames(list)).toEqual([
      expect.stringContaining('state 2'),
      expect.stringContaining('default'),
      expect.stringContaining('state 3'),
    ]);
  });

  it('moves a row down a place with Alt+ArrowDown', async () => {
    const { user } = setup();
    const list = await addTwoMore(user);
    within(list).getByRole('button', { name: 'state 2' }).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(rowNames(list)).toEqual([
      expect.stringContaining('default'),
      expect.stringContaining('state 3'),
      expect.stringContaining('state 2'),
    ]);
  });

  it('keeps focus on the row across two presses, so the second continues the move', async () => {
    const { user } = setup();
    const list = await addTwoMore(user);
    within(list).getByRole('button', { name: 'default' }).focus();

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(within(list).getByRole('button', { name: 'default' })).toHaveFocus();

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(within(list).getByRole('button', { name: 'default' })).toHaveFocus();

    // Started on top, two presses down: two places along, at the back.
    expect(rowNames(list)).toEqual([
      expect.stringContaining('state 2'),
      expect.stringContaining('state 3'),
      expect.stringContaining('default'),
    ]);
  });

  it('will not move the top row further up', async () => {
    const { user } = setup();
    const list = await addTwoMore(user);
    within(list).getByRole('button', { name: 'default' }).focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(rowNames(list)).toEqual([
      expect.stringContaining('default'),
      expect.stringContaining('state 2'),
      expect.stringContaining('state 3'),
    ]);
  });

  it('will not move the bottom row further down', async () => {
    const { user } = setup();
    const list = await addTwoMore(user);
    within(list).getByRole('button', { name: 'state 3' }).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(rowNames(list)).toEqual([
      expect.stringContaining('default'),
      expect.stringContaining('state 2'),
      expect.stringContaining('state 3'),
    ]);
  });

  it('leaves plain arrows alone', async () => {
    const { user } = setup();
    const list = await addTwoMore(user);
    within(list).getByRole('button', { name: 'state 2' }).focus();
    await user.keyboard('{ArrowUp}');
    await user.keyboard('{ArrowDown}');
    expect(rowNames(list)).toEqual([
      expect.stringContaining('default'),
      expect.stringContaining('state 2'),
      expect.stringContaining('state 3'),
    ]);
  });

  it('announces the move for screen readers', async () => {
    const { user } = setup();
    const list = await addTwoMore(user);
    within(list).getByRole('button', { name: 'state 2' }).focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(screen.getByText('state 2 moved up, now 1 of 3')).toBeInTheDocument();
  });
});
