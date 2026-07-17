import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { TerminalSession } from '../../api/types';
import { TerminalSessionScreen } from './terminal-session-screen';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigateMock }));

const { createMutateMock } = vi.hoisted(() => ({ createMutateMock: vi.fn() }));
vi.mock('../../api/use-create-terminal-session', () => ({
  useCreateTerminalSession: () => ({ mutate: createMutateMock, isPending: false }),
}));

vi.mock('../../api/use-archive-terminal-session', () => ({
  useArchiveTerminalSession: () => ({ mutate: vi.fn(), isPending: false }),
  useUnarchiveTerminalSession: () => ({ mutate: vi.fn(), isPending: false }),
}));

// A session in 'exited' status with the socket already 'ended' so Restart is
// visible without wiring up a real WebSocket.
vi.mock('../../api/use-terminal-session', () => ({
  useTerminalSession: (id: number): { data: TerminalSession } => ({
    data: {
      id,
      title: 'shell',
      workdirId: 1,
      cwd: '/work/tickets',
      status: 'exited',
      exitCode: 0,
      startedBy: null,
      createdAt: '2026-07-17T00:00:00Z',
      updatedAt: '2026-07-17T00:00:00Z',
      endedAt: '2026-07-17T00:01:00Z',
      archivedAt: null,
    },
  }),
}));

vi.mock('../session/use-session-socket', () => ({
  useSessionSocket: () => ({
    conn: 'ended',
    status: 'exited',
    exitCode: 0,
    truncated: false,
    integrated: false,
    activity: null,
    sendInput: vi.fn(),
    sendResize: vi.fn(),
    interrupt: vi.fn(),
  }),
}));

function renderScreen(sessionId = 7) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TerminalSessionScreen sessionId={sessionId} />
    </QueryClientProvider> as ReactNode,
  );
}

beforeEach(() => {
  navigateMock.mockClear();
  createMutateMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a restarted terminal opens the new session under /terminals', async () => {
  createMutateMock.mockImplementation((_input, opts?: { onSuccess?: (s: { id: number }) => void }) =>
    opts?.onSuccess?.({ id: 42 }),
  );
  renderScreen(7);
  await userEvent.click(screen.getByRole('button', { name: 'Restart' }));
  expect(navigateMock).toHaveBeenCalledWith({
    to: '/terminals/$sessionId',
    params: { sessionId: '42' },
  });
});
