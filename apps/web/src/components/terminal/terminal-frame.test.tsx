import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TerminalFrame } from './terminal-frame';

test('shows the title, workspace path, and live connection indicator', () => {
  render(
    <TerminalFrame title="pnpm test" workspacePath="~/work/tickets" conn="live">
      <div>canvas</div>
    </TerminalFrame>,
  );
  expect(screen.getByText('pnpm test')).toBeInTheDocument();
  expect(screen.getByText('~/work/tickets')).toBeInTheDocument();
  expect(screen.getByText('live')).toBeInTheDocument();
});

test('reports a non-zero exit code and offers Restart when ended', () => {
  render(
    <TerminalFrame title="shell" conn="ended" exitCode={1} onRestart={() => {}}>
      <div>canvas</div>
    </TerminalFrame>,
  );
  expect(screen.getByText('1')).toHaveClass('text-red-9');
  expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
});

test('surfaces a scrollback-truncation notice while still live', () => {
  render(
    <TerminalFrame title="shell" conn="live" truncated>
      <div>canvas</div>
    </TerminalFrame>,
  );
  expect(screen.getByText(/pruned from scrollback/i)).toBeInTheDocument();
  // Still live → no Restart.
  expect(screen.queryByRole('button', { name: 'Restart' })).toBeNull();
});
