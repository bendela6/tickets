import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ItemKey } from './item-key';

test('renders prefix-number', () => {
  render(<ItemKey prefix="CORE" number={128} />);
  expect(screen.getByText('CORE-128')).toBeInTheDocument();
});

test('muted swaps to the dim ink color', () => {
  const { rerender } = render(<ItemKey prefix="WEB" number={9} />);
  expect(screen.getByText('WEB-9')).toHaveClass('text-gray-12');
  rerender(<ItemKey prefix="WEB" number={9} muted />);
  expect(screen.getByText('WEB-9')).toHaveClass('text-gray-9');
});
