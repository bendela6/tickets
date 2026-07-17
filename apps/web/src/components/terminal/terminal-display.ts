import type { TerminalStatus } from '../../api/types';
import type { ConnState } from '../session/use-session-socket';

// Compose the terminal pill from the persisted status, the live socket
// connection, and the output-activity pulse. Dead states win over connection;
// otherwise connection state, then live→busy?Running:Ready.
const MAX_COMMAND_LEN = 40;

function truncateCommand(command: string): string {
  return command.length > MAX_COMMAND_LEN ? `${command.slice(0, MAX_COMMAND_LEN)}…` : command;
}

export function terminalDisplay(
  conn: ConnState,
  status: TerminalStatus,
  busy: boolean,
  command?: string,
): { status: TerminalStatus | 'running'; label: string; pulse: boolean } {
  if (status === 'exited') return { status: 'exited', label: 'Exited', pulse: false };
  if (status === 'disconnected') return { status: 'disconnected', label: 'Disconnected', pulse: false };
  if (status === 'failed') return { status: 'failed', label: "Couldn't start", pulse: false };
  if (conn === 'ended' && (status === 'live' || status === 'starting')) {
    return { status: 'disconnected', label: 'Disconnected', pulse: false };
  }
  if (conn === 'connecting') return { status: 'starting', label: 'Connecting', pulse: false };
  if (conn === 'reconnecting') return { status: 'starting', label: 'Reconnecting', pulse: false };
  if (status === 'live') {
    return busy
      ? {
          status: 'running',
          label: command ? `Running: ${truncateCommand(command)}` : 'Running',
          pulse: true,
        }
      : { status: 'live', label: 'Ready', pulse: false };
  }
  if (status === 'starting') return { status: 'starting', label: 'Connecting', pulse: false };
  return { status, label: String(status), pulse: false };
}
