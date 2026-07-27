import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { CostMeter } from './cost-meter';

test('uncapped shows only spend, no cap text', () => {
  render(<CostMeter costUsd={1.06} />);
  expect(screen.getByText('$1.06')).toBeInTheDocument();
  expect(screen.queryByText(/\//)).toBeNull();
});

test('capped shows spend / cap', () => {
  render(<CostMeter costUsd={0.88} capUsd={5} />);
  expect(screen.getByText('$0.88')).toBeInTheDocument();
  expect(screen.getByText('/ $5.00')).toBeInTheDocument();
});

test('crossing the cap turns the spend danger-coloured', () => {
  render(<CostMeter costUsd={6} capUsd={5} />);
  expect(screen.getByText('$6.00')).toHaveClass('text-red-9');
});
