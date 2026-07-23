import { definePlayground, number, select } from '@tickets/ui/gallery';
import { SessionStatusPill, type SessionStatus } from './session-status-pill';

const SESSION_STATUSES: SessionStatus[] = [
  'starting',
  'running',
  'idle',
  'awaiting_input',
  'interrupted',
  'exited',
  'failed',
];

export const meta = { title: 'Session Status Pill', group: 'AI session', order: 1 };

export const states = [
  ...SESSION_STATUSES.map((status) => ({
    name: status,
    render: () => (
      <SessionStatusPill
        status={status}
        exitCode={status === 'exited' ? 0 : undefined}
      />
    ),
  })),
  {
    name: 'exited-code-1',
    render: () => <SessionStatusPill status="exited" exitCode={1} />,
  },
];

export const playground = definePlayground({
  controls: {
    status: select(SESSION_STATUSES, { initial: 'running' }),
    exitCode: number(0, { min: 0, max: 255 }),
  },
  render: ({ status, exitCode }) => (
    <SessionStatusPill
      status={status}
      exitCode={status === 'exited' ? exitCode : undefined}
    />
  ),
});
