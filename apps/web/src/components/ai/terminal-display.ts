import type { SessionStatus } from '../../api/types';
import type { ConnState } from './use-session-socket';

// Compose the terminal pill from the persisted status, the live socket
// connection, and the output-activity pulse. Dead states win over connection;
// otherwise connection state, then live→busy?Running:Ready.
export function terminalDisplay(
  conn: ConnState,
  status: SessionStatus,
  busy: boolean,
): { status: SessionStatus; label: string; pulse: boolean } {
  if (status === 'exited') return { status: 'exited', label: 'Exited', pulse: false };
  if (status === 'disconnected') return { status: 'disconnected', label: 'Disconnected', pulse: false };
  if (status === 'failed') return { status: 'failed', label: "Couldn't start", pulse: false };
  if (conn === 'connecting') return { status: 'starting', label: 'Connecting', pulse: false };
  if (conn === 'reconnecting') return { status: 'starting', label: 'Reconnecting', pulse: false };
  if (status === 'live') {
    return busy
      ? { status: 'running', label: 'Running', pulse: true }
      : { status: 'live', label: 'Ready', pulse: false };
  }
  if (status === 'starting') return { status: 'starting', label: 'Connecting', pulse: false };
  return { status, label: String(status), pulse: false };
}
