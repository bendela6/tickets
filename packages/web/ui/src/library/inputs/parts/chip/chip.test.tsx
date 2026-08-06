import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { CONTROL_LADDER } from '../../contract';
import { Chip } from './chip';

test('the remove target is the full square, not a glyph inside it', () => {
  // The design is explicit: "its remove target is the full 24px square". The
  // version everyone ships is a small × floating in a large chip — roughly a
  // 10px target inside a 24px one, which misses on every touch.
  render(<Chip label="frontend" onRemove={() => {}} />);
  const remove = screen.getByRole('button', { name: /remove frontend/i });
  expect(remove.className).toContain(CONTROL_LADDER.md.chip);
  expect(remove.className).toMatch(/\baspect-square\b/);
});

test('removing does not also fire the chip body', async () => {
  // They are nested targets; without stopPropagation, removing a chip in a
  // MultiSelect trigger would also open the popup.
  const events: string[] = [];
  render(
    <Chip label="api" onClick={() => events.push('body')} onRemove={() => events.push('remove')} />,
  );
  await userEvent.click(screen.getByRole('button', { name: /remove api/i }));
  expect(events).toEqual(['remove']);
});

test('a chip with no onRemove renders no remove target at all', () => {
  render(<Chip label="locked" />);
  expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
});

test('+N is the same component, so overflow is focusable rather than decorative', () => {
  render(<Chip label="+3" onClick={() => {}} />);
  expect(screen.getByRole('button', { name: '+3' })).toBeTruthy();
});

test('every rung takes its height from the ladder', () => {
  for (const size of ['xs', 'md', 'lg'] as const) {
    const { unmount } = render(<Chip label={size} size={size} />);
    const chip = screen.getByText(size).closest('[data-chip]')!;
    expect(chip.className, size).toContain(CONTROL_LADDER[size].chip);
    unmount();
  }
});

test('the fill follows tone, so a danger chip is not indigo', () => {
  render(<Chip label="overdue" tone="danger" />);
  // The hue, not the rung — the rung is the design's to move.
  expect(screen.getByText('overdue').closest('[data-chip]')!.className).toMatch(/bg-red-\d/);
});
