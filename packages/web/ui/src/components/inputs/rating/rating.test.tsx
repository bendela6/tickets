import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Rating } from './rating';

const marks = () => screen.getAllByRole('radio');

test('picking a mark reports its position', async () => {
  const onChange = vi.fn();
  render(<Rating label="Severity" value={0} onChange={onChange} />);
  await userEvent.click(marks()[2]!);
  expect(onChange).toHaveBeenCalledWith(3);
});

test('clicking the mark you are already on clears the rating', async () => {
  // Otherwise a one-star rating is the only one that cannot be taken back.
  const onChange = vi.fn();
  render(<Rating label="Severity" value={1} onChange={onChange} />);
  await userEvent.click(marks()[0]!);
  expect(onChange).toHaveBeenCalledWith(0);
});

test('a hover preview is a DIFFERENT rung from the committed value', async () => {
  // Without two rungs you cannot tell whether moving the mouse has already
  // changed something — the single most common complaint about star ratings.
  render(<Rating label="Severity" value={3} onChange={() => {}} />);
  const committed = marks()[0]!.className;

  await userEvent.hover(marks()[3]!);
  const previewed = marks()[0]!.className;

  expect(previewed).not.toBe(committed);
  expect(committed).toMatch(/text-indigo-9/);
  expect(previewed).toMatch(/text-indigo-8/);
});

test('the preview is abandoned when the pointer leaves', async () => {
  render(<Rating label="Severity" value={2} onChange={() => {}} />);
  const before = marks()[0]!.className;
  await userEvent.hover(marks()[4]!);
  await userEvent.unhover(marks()[4]!);
  // unhover leaves the mark but not the group; leaving the group is what resets.
  await userEvent.unhover(screen.getByRole('radiogroup'));
  expect(marks()[0]!.className).toBe(before);
});

test('unrated is 0, and says so rather than showing 0/5', () => {
  render(<Rating label="Severity" value={0} onChange={() => {}} showValue />);
  expect(screen.getByText('Not rated')).toBeInTheDocument();
});

test('read-only keeps its tab stop and refuses the click', async () => {
  const onChange = vi.fn();
  render(<Rating label="Severity" value={3} onChange={onChange} readOnly />);
  const group = screen.getByRole('radiogroup');
  expect(group).toHaveAttribute('aria-readonly', 'true');
  expect(group).not.toHaveAttribute('aria-disabled');
  expect(marks()[0]!.getAttribute('tabindex')).toBe('0');
  await userEvent.click(marks()[4]!);
  expect(onChange).not.toHaveBeenCalled();
});

test('disabled leaves the tab order entirely', () => {
  render(<Rating label="Severity" value={3} onChange={() => {}} disabled />);
  expect(marks()[0]!.getAttribute('tabindex')).toBe('-1');
  expect(marks()[0]!).toBeDisabled();
});

test('the scale length is the callers to set', () => {
  render(<Rating label="Confidence" value={0} onChange={() => {}} max={3} />);
  expect(marks()).toHaveLength(3);
});
