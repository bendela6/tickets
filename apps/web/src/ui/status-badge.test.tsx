import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { StatusBadge } from './status-badge';

test('renders label with kind styling and glyph', () => {
  render(<StatusBadge kind="active" label="In progress" />);
  const badge = screen.getByText('In progress').closest('span');
  expect(badge).toHaveClass('bg-kind-active-subtle');
});

test('dropped statuses get struck labels', () => {
  render(<StatusBadge kind="dropped" label="Won't do" />);
  expect(screen.getByText("Won't do")).toHaveClass('line-through');
});
