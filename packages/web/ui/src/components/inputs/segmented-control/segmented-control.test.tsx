import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { SegmentedControl } from './segmented-control';

const VIEWS = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
  { value: 'calendar', label: 'Calendar' },
];

test('picking a segment reports its value', async () => {
  const onChange = vi.fn();
  render(<SegmentedControl label="View" options={VIEWS} value="list" onChange={onChange} />);
  await userEvent.click(screen.getByRole('radio', { name: 'Board' }));
  expect(onChange).toHaveBeenCalledWith('board');
});

test('exactly one segment is checked', () => {
  render(<SegmentedControl label="View" options={VIEWS} value="board" onChange={() => {}} />);
  const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
  expect(checked).toHaveLength(1);
  expect(checked[0]).toHaveAccessibleName('Board');
});

test('there is ONE indicator that moves, not one per segment', () => {
  // A tile per segment that lights up would read as separate buttons sitting
  // together; the movement is what says these are positions on one control.
  const { container, rerender } = render(
    <SegmentedControl label="View" options={VIEWS} value="list" onChange={() => {}} />,
  );
  const indicators = () => container.querySelectorAll('[aria-hidden][style*="left"]');
  expect(indicators()).toHaveLength(1);
  const at0 = (indicators()[0] as HTMLElement).style.left;

  rerender(<SegmentedControl label="View" options={VIEWS} value="calendar" onChange={() => {}} />);
  expect(indicators()).toHaveLength(1);
  expect((indicators()[0] as HTMLElement).style.left).not.toBe(at0);
});

test('a value matching no option draws no indicator rather than one at zero', () => {
  // Parking it under the first segment would claim a selection that is not made.
  const { container } = render(
    <SegmentedControl label="View" options={VIEWS} value="gantt" onChange={() => {}} />,
  );
  expect(container.querySelectorAll('[aria-hidden][style*="left"]')).toHaveLength(0);
});

test('the focus ring is inward, because the segments are joined', () => {
  render(<SegmentedControl label="View" options={VIEWS} value="list" onChange={() => {}} />);
  expect(screen.getByRole('radio', { name: 'Board' }).className).toMatch(/ring-inset/);
});

test('read-only keeps every tab stop and refuses the click', async () => {
  const onChange = vi.fn();
  render(<SegmentedControl label="View" options={VIEWS} value="list" onChange={onChange} readOnly />);
  const group = screen.getByRole('radiogroup');
  expect(group).toHaveAttribute('aria-readonly', 'true');
  expect(group).not.toHaveAttribute('aria-disabled');
  expect(screen.getByRole('radio', { name: 'Board' }).getAttribute('tabindex')).toBe('0');
  await userEvent.click(screen.getByRole('radio', { name: 'Board' }));
  expect(onChange).not.toHaveBeenCalled();
});

test('disabled leaves the tab order and refuses the click', async () => {
  const onChange = vi.fn();
  render(<SegmentedControl label="View" options={VIEWS} value="list" onChange={onChange} disabled />);
  const board = screen.getByRole('radio', { name: 'Board' });
  expect(board.getAttribute('tabindex')).toBe('-1');
  expect(board).toBeDisabled();
  await userEvent.click(board);
  expect(onChange).not.toHaveBeenCalled();
});

test('a single disabled option refuses without disabling the group', async () => {
  const onChange = vi.fn();
  render(
    <SegmentedControl
      label="View"
      options={[...VIEWS, { value: 'gantt', label: 'Gantt', disabled: true }]}
      value="list"
      onChange={onChange}
    />,
  );
  await userEvent.click(screen.getByRole('radio', { name: 'Gantt' }));
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('radio', { name: 'Board' }));
  expect(onChange).toHaveBeenCalledWith('board');
});
