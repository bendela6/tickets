import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ItemKey } from './item-key';

test('renders the item key as it is stored', () => {
  render(<ItemKey itemKey="CORE-128" />);
  expect(screen.getByText('CORE-128')).toBeInTheDocument();
});

test("renders a plan's keys: an epic's slash and a ticket's dots", () => {
  render(
    <>
      <ItemKey itemKey="TK/E14" />
      <ItemKey itemKey="TK-80.3" />
    </>,
  );
  expect(screen.getByText('TK/E14')).toBeInTheDocument();
  expect(screen.getByText('TK-80.3')).toBeInTheDocument();
});

test('muted swaps to the dim ink color', () => {
  const { rerender } = render(<ItemKey itemKey="WEB-9" />);
  expect(screen.getByText('WEB-9')).toHaveClass('text-gray-12');
  rerender(<ItemKey itemKey="WEB-9" muted />);
  expect(screen.getByText('WEB-9')).toHaveClass('text-gray-9');
});
