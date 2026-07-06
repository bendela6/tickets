import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

test('renders into jsdom', () => {
  render(<button>hi</button>);
  expect(screen.getByRole('button', { name: 'hi' })).toBeInTheDocument();
});
