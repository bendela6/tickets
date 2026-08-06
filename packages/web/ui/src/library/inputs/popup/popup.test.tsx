import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { Popup, popupClass } from './popup';

test('the shell renders nothing until it is opened', () => {
  render(
    <Popup open={false} onOpenChange={() => {}} trigger={<button>Open</button>}>
      <p>contents</p>
    </Popup>,
  );
  expect(screen.queryByText('contents')).toBeNull();
});

test('the shell knows nothing about its contents — a grid is as valid as a list', () => {
  // The whole reason Popup and OptionRow are separate components: the colour
  // and icon pickers are grids, and they take the shell with no rows at all. If
  // this ever needs a `layout` prop, the boundary has been drawn wrong.
  render(
    <Popup open onOpenChange={() => {}} trigger={<button>Open</button>}>
      <div data-testid="grid" role="grid" />
    </Popup>,
  );
  expect(screen.getByTestId('grid')).toBeTruthy();
});

test('the trigger stays interactive and reports open state back', async () => {
  const seen: boolean[] = [];
  render(
    <Popup open={false} onOpenChange={(v) => seen.push(v)} trigger={<button>Open</button>}>
      <p>contents</p>
    </Popup>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(seen).toContain(true);
});

test('the geometry is one recipe, so a caller rendering its own container matches', () => {
  // Asserted as a shape — that it carries a radius and a padding — never as the
  // rung values, which are the design's to move.
  expect(popupClass).toMatch(/rounded-/);
  expect(popupClass).toMatch(/\bp-\d/);
});
