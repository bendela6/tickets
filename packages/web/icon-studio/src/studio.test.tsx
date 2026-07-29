import { render, screen } from '@testing-library/react';
import { Studio } from './studio';

test('renders the studio heading', () => {
  render(<Studio />);
  expect(screen.getByRole('heading', { name: 'Icon studio' })).toBeDefined();
});
