import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { AgentSession, AgentSessionStatus } from '../../api/types';
import { AgentSessionScreen } from './agent-session-screen';

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

const { stopMutateMock, archiveMutateMock, statusState } = vi.hoisted(() => ({
  stopMutateMock: vi.fn(),
  archiveMutateMock: vi.fn(),
  // The agent screen branches its menu on the session status, so each test
  // picks one.
  statusState: { current: 'running' as AgentSessionStatus },
}));

vi.mock('../../api/use-archive-agent-session', () => ({
  useStopAgentSession: () => ({ mutate: stopMutateMock, isPending: false }),
  useArchiveAgentSession: () => ({ mutate: archiveMutateMock, isPending: false }),
  useUnarchiveAgentSession: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../api/use-agent-session', () => ({
  useAgentSession: (id: number): { data: AgentSession } => ({
    data: {
      id,
      title: 'reviewer',
      workdirId: 1,
      agentId: 1,
      itemId: null,
      parentSessionId: null,
      cwd: '/work/tickets',
      worktreePath: null,
      status: statusState.current,
      costUsd: null,
      startedBy: null,
      createdAt: '2026-07-17T00:00:00Z',
      updatedAt: '2026-07-17T00:00:00Z',
      endedAt: null,
      archivedAt: null,
    } as AgentSession,
  }),
}));

vi.mock('../session/use-session-socket', () => ({
  useSessionSocket: () => ({
    conn: 'live',
    status: statusState.current,
    truncated: false,
    sendPrompt: vi.fn(),
    sendPermission: vi.fn(),
    interrupt: vi.fn(),
  }),
}));

function renderScreen(sessionId = 3) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AgentSessionScreen sessionId={sessionId} />
    </QueryClientProvider> as ReactNode,
  );
}

beforeEach(() => {
  stopMutateMock.mockReset();
  archiveMutateMock.mockReset();
  statusState.current = 'running';
});

// Same contract as the terminal screen's menu: ending stops the run and leaves
// the session listed to read its transcript; archiving is the separate act
// that hides it.
test('"End session" stops the run — it does not archive it', async () => {
  statusState.current = 'running';
  renderScreen(3);
  vi.stubGlobal('confirm', () => true);
  await userEvent.click(screen.getByRole('button', { name: 'Session actions' }));
  await userEvent.click(await screen.findByText('End session'));
  expect(stopMutateMock).toHaveBeenCalledWith(3);
  expect(archiveMutateMock).not.toHaveBeenCalled();
});

// The menu used to offer a destructive "End session" ("The process will be
// stopped") on a session whose process had already exited — there was nothing
// to stop. It now mirrors the terminal screen's ended branch.
test.each<AgentSessionStatus>(['exited', 'failed', 'interrupted'])(
  'an already-ended (%s) session offers Archive, not End session',
  async (status) => {
    statusState.current = status;
    renderScreen(3);
    await userEvent.click(screen.getByRole('button', { name: 'Session actions' }));
    expect(screen.queryByText('End session')).toBeNull();
    await userEvent.click(await screen.findByText('Archive'));
    expect(archiveMutateMock).toHaveBeenCalledWith(3);
    expect(stopMutateMock).not.toHaveBeenCalled();
  },
);
