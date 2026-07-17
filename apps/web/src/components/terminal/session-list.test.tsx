import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { TerminalSession } from '../../api/types';
import { SessionList } from './session-list';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...rest }: { children: ReactNode }) => <a {...rest}>{children}</a>,
}));

const { archiveMutateMock, unarchiveMutateMock } = vi.hoisted(() => ({
  archiveMutateMock: vi.fn(),
  unarchiveMutateMock: vi.fn(),
}));
vi.mock('../../api/use-archive-terminal-session', () => ({
  useArchiveTerminalSession: () => ({ mutate: archiveMutateMock, isPending: false }),
  useUnarchiveTerminalSession: () => ({ mutate: unarchiveMutateMock, isPending: false }),
}));

const session: TerminalSession = {
  id: 5,
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
};

const renderList = (archived: boolean) =>
  render(
    (<SessionList sessions={[session]} workdirName={() => 'tickets'} archived={archived} />) as ReactNode,
  );

beforeEach(() => {
  archiveMutateMock.mockReset();
  unarchiveMutateMock.mockReset();
});

// The terminal list's archive/unarchive toggle, mirroring agent/session-list.
// Pinned because the unarchive half reads as dead code from the hook's side —
// its only caller is this row, behind the panel's "Show archived" toggle.
test('the row archives a listed session', async () => {
  renderList(false);
  await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
  expect(archiveMutateMock).toHaveBeenCalledWith(5);
  expect(unarchiveMutateMock).not.toHaveBeenCalled();
});

test('the row unarchives when the list is showing archived sessions', async () => {
  renderList(true);
  await userEvent.click(screen.getByRole('button', { name: 'Unarchive' }));
  expect(unarchiveMutateMock).toHaveBeenCalledWith(5);
  expect(archiveMutateMock).not.toHaveBeenCalled();
});
