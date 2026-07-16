import { render, screen } from '@testing-library/react';
import { expect, it, test } from 'vitest';
import { SessionStatusPill } from './session-status-pill';

test('renders the status label with its pill styling', () => {
  render(<SessionStatusPill status="running" />);
  expect(screen.getByText('running').closest('span')).toHaveClass('bg-kind-active-subtle');
});

test('awaiting_input reads as a distinct, attention-seeking pill', () => {
  render(<SessionStatusPill status="awaiting_input" />);
  const pill = screen.getByText('awaiting input').closest('span');
  // Solid + pulsing, unlike the calm subtle-background idle pill.
  expect(pill).toHaveClass('bg-kind-blocked');
  expect(pill).toHaveClass('animate-ai-pulse');
});

test('exited shows a zero exit code in the success colour', () => {
  render(<SessionStatusPill status="exited" exitCode={0} />);
  expect(screen.getByText('0')).toHaveClass('text-kind-done');
});

test('exited shows a non-zero exit code in the danger colour', () => {
  render(<SessionStatusPill status="exited" exitCode={1} />);
  expect(screen.getByText('1')).toHaveClass('text-danger');
});

test('omits the code chip when there is no exit code', () => {
  render(<SessionStatusPill status="exited" />);
  expect(screen.getByText('exited').closest('span')?.querySelector('.font-mono')).toBeNull();
});

it('labels the new terminal states', () => {
  render(<SessionStatusPill status="live" kind="terminal" />);
  expect(screen.getByText('Live')).toBeInTheDocument();
});
it('reads failed as "Couldn\'t start" for a terminal', () => {
  render(<SessionStatusPill status="failed" kind="terminal" />);
  expect(screen.getByText("Couldn't start")).toBeInTheDocument();
});
it('keeps the agent/default wording for failed', () => {
  render(<SessionStatusPill status="failed" />);
  expect(screen.getByText('failed')).toBeInTheDocument();
});
it('honours an explicit label override', () => {
  render(<SessionStatusPill status="running" label="Running" />);
  expect(screen.getByText('Running')).toBeInTheDocument();
});
