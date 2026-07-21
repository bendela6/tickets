import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { StatusChip } from './status-chip';

test('renders the status label', () => {
  render(<StatusChip status="open" />);
  expect(screen.getByText('open')).toBeInTheDocument();
});

test('resolved and ignored render their own shape-coded glyph + label', () => {
  render(<StatusChip status="resolved" />);
  expect(screen.getByText('resolved')).toBeInTheDocument();

  render(<StatusChip status="ignored" />);
  expect(screen.getByText('ignored')).toBeInTheDocument();
});

test('does not show a regressed chip by default', () => {
  render(<StatusChip status="open" />);
  expect(screen.queryByText(/regressed/i)).not.toBeInTheDocument();
});

test('shows an adjacent regressed chip without replacing the status chip', () => {
  render(<StatusChip status="open" regressed />);
  expect(screen.getByText('open')).toBeInTheDocument();
  expect(screen.getByText(/regressed/i)).toBeInTheDocument();
});

test('regressed chip does not appear for resolved/ignored unless flagged', () => {
  render(<StatusChip status="resolved" regressed={false} />);
  expect(screen.queryByText(/regressed/i)).not.toBeInTheDocument();
});
