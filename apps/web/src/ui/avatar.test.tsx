import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Avatar } from './avatar';

test('agent avatars are square, humans round', () => {
  const { rerender } = render(<Avatar name="claude-worker" kind="agent" />);
  expect(screen.getByTitle('claude-worker')).toHaveClass('rounded-md');
  rerender(<Avatar name="Mara K." kind="human" />);
  expect(screen.getByTitle('Mara K.')).toHaveClass('rounded-full');
});
