import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { TerminalSession } from '../../api/types';
import type { ConnState } from '../session/use-session-socket';
import { TerminalSessionScreen } from './terminal-session-screen';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigateMock }));

const { restartMutateMock, stopMutateMock, archiveMutateMock } = vi.hoisted(() => ({
  restartMutateMock: vi.fn(),
  stopMutateMock: vi.fn(),
  archiveMutateMock: vi.fn(),
}));
vi.mock('../../api/use-restart-terminal-session', () => ({
  useRestartTerminalSession: () => ({ mutate: restartMutateMock, isPending: false }),
}));

vi.mock('../../api/use-archive-terminal-session', () => ({
  useStopTerminalSession: () => ({ mutate: stopMutateMock, isPending: false }),
  useArchiveTerminalSession: () => ({ mutate: archiveMutateMock, isPending: false }),
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

// Per-test override so both menu branches are reachable: the terminal screen
// keys 'End session' vs 'Archive' off socket.conn.
const { connState } = vi.hoisted(() => ({ connState: { current: 'ended' as ConnState } }));
vi.mock('../session/use-session-socket', () => ({
  useSessionSocket: () => ({
    conn: connState.current,
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
  connState.current = 'ended';
  navigateMock.mockClear();
  restartMutateMock.mockReset();
  stopMutateMock.mockReset();
  archiveMutateMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('Restart respawns the SAME session (no new record, no navigation)', async () => {
  renderScreen(7);
  await userEvent.click(screen.getByRole('button', { name: 'Restart' }));
  // Restarts this session id in place…
  expect(restartMutateMock).toHaveBeenCalledWith(7, expect.anything());
  // …and does NOT navigate to a different session.
  expect(navigateMock).not.toHaveBeenCalled();
});

// "End session" and "Archive" are two different acts and must stay two
// different calls: ending stops the PTY and leaves the row listed as exited,
// archiving is what hides it. Folding End into archive made ending a session
// hide it immediately, which is the bug these two tests pin.
test('"End session" stops the session — it does not archive it', async () => {
  connState.current = 'live';
  renderScreen(7);
  vi.stubGlobal('confirm', () => true);
  await userEvent.click(screen.getByRole('button', { name: 'Session actions' }));
  await userEvent.click(await screen.findByText('End session'));
  expect(stopMutateMock).toHaveBeenCalledWith(7);
  expect(archiveMutateMock).not.toHaveBeenCalled();
});

test('once ended the menu offers Archive, which archives', async () => {
  connState.current = 'ended';
  renderScreen(7);
  await userEvent.click(screen.getByRole('button', { name: 'Session actions' }));
  expect(screen.queryByText('End session')).toBeNull();
  await userEvent.click(await screen.findByText('Archive'));
  expect(archiveMutateMock).toHaveBeenCalledWith(7);
  expect(stopMutateMock).not.toHaveBeenCalled();
});
