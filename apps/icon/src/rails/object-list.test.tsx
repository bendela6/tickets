import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../app';

const setup = () => {
  const user = userEvent.setup();
  render(<App />);
  return { user };
};

const objectRail = () => screen.getByRole('complementary', { name: 'Objects' });

/** Front-to-back, the order the design reads the list in. */
const rowNames = () =>
  within(objectRail())
    .getAllByRole('listitem')
    .map((row) => row.textContent);

/**
 * Three shapes with distinct, addressable names. Each new one lands in front
 * of the last, so pressing r, c, e in that order reads back top to bottom as
 * ellipse 3, circle 2, rect 1.
 */
const addThree = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.keyboard('r');
  await user.keyboard('c');
  await user.keyboard('e');
};

describe('reordering objects from the keyboard', () => {
  it('moves a row up a place with Alt+ArrowUp', async () => {
    const { user } = setup();
    await addThree(user);
    within(objectRail()).getByRole('button', { name: 'circle 2' }).focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(rowNames()).toEqual([
      expect.stringContaining('circle 2'),
      expect.stringContaining('ellipse 3'),
      expect.stringContaining('rect 1'),
    ]);
  });

  it('moves a row down a place with Alt+ArrowDown', async () => {
    const { user } = setup();
    await addThree(user);
    within(objectRail()).getByRole('button', { name: 'circle 2' }).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(rowNames()).toEqual([
      expect.stringContaining('ellipse 3'),
      expect.stringContaining('rect 1'),
      expect.stringContaining('circle 2'),
    ]);
  });

  it('keeps focus on the row across two presses, so the second continues the move', async () => {
    const { user } = setup();
    await addThree(user);
    within(objectRail()).getByRole('button', { name: 'ellipse 3' }).focus();

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(within(objectRail()).getByRole('button', { name: 'ellipse 3' })).toHaveFocus();

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(within(objectRail()).getByRole('button', { name: 'ellipse 3' })).toHaveFocus();

    // Started on top, two presses down: two places along, at the back.
    expect(rowNames()).toEqual([
      expect.stringContaining('circle 2'),
      expect.stringContaining('rect 1'),
      expect.stringContaining('ellipse 3'),
    ]);
  });

  it('will not move the top row further up', async () => {
    const { user } = setup();
    await addThree(user);
    within(objectRail()).getByRole('button', { name: 'ellipse 3' }).focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(rowNames()).toEqual([
      expect.stringContaining('ellipse 3'),
      expect.stringContaining('circle 2'),
      expect.stringContaining('rect 1'),
    ]);
  });

  it('will not move the bottom row further down', async () => {
    const { user } = setup();
    await addThree(user);
    within(objectRail()).getByRole('button', { name: 'rect 1' }).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(rowNames()).toEqual([
      expect.stringContaining('ellipse 3'),
      expect.stringContaining('circle 2'),
      expect.stringContaining('rect 1'),
    ]);
  });

  it('leaves plain arrows alone', async () => {
    const { user } = setup();
    await addThree(user);
    within(objectRail()).getByRole('button', { name: 'circle 2' }).focus();
    await user.keyboard('{ArrowUp}');
    await user.keyboard('{ArrowDown}');
    expect(rowNames()).toEqual([
      expect.stringContaining('ellipse 3'),
      expect.stringContaining('circle 2'),
      expect.stringContaining('rect 1'),
    ]);
  });

  it('announces the move for screen readers', async () => {
    const { user } = setup();
    await addThree(user);
    within(objectRail()).getByRole('button', { name: 'circle 2' }).focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(screen.getByText('circle 2 moved up, now 1 of 3')).toBeInTheDocument();
  });
});
