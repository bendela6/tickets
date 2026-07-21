import type { Mode } from './mode-for-path';
import { AgentsPanel } from './agents-panel';
import { SignalsPanel } from './signals-panel';
import { TasksPanel } from './tasks-panel';
import { TerminalsPanel } from './terminals-panel';

// The ~210px context panel beside the rail. Its contents follow the active mode.
export function ModePanel({
  mode,
  activeProjectKey,
  onNewTicket,
  onNavigate,
  onNavigateSession,
}: {
  mode: Mode | null;
  activeProjectKey?: string;
  onNewTicket?: () => void;
  onNavigate?: () => void;
  onNavigateSession: (sessionId: number) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3.5">
      {mode === 'terminals' ? (
        <TerminalsPanel onNavigateSession={onNavigateSession} onNavigate={onNavigate} />
      ) : mode === 'agents' ? (
        <AgentsPanel onNavigate={onNavigate} />
      ) : mode === 'signals' ? (
        <SignalsPanel onNavigate={onNavigate} />
      ) : mode === 'tasks' ? (
        <TasksPanel activeProjectKey={activeProjectKey} onNewTicket={onNewTicket} onNavigate={onNavigate} />
      ) : null}
    </div>
  );
}
