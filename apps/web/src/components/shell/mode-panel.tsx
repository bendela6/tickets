import type { Mode } from './mode-for-path';
import { SchemaPanel } from './schema-panel';
import { SignalsPanel } from './signals-panel';
import { TasksPanel } from './tasks-panel';

// The ~210px context panel beside the rail. Its contents follow the active mode.
export function ModePanel({
  mode,
  activeProjectKey,
  onNewTicket,
  onNavigate,
  schemaDatabase,
}: {
  mode: Mode | null;
  activeProjectKey?: string;
  onNewTicket?: () => void;
  onNavigate?: () => void;
  schemaDatabase?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-12 pb-12 pt-14">
      {mode === 'signals' ? (
        <SignalsPanel onNavigate={onNavigate} />
      ) : mode === 'schema' ? (
        <SchemaPanel selected={schemaDatabase} onNavigate={onNavigate} />
      ) : mode === 'tasks' ? (
        <TasksPanel activeProjectKey={activeProjectKey} onNewTicket={onNewTicket} onNavigate={onNavigate} />
      ) : null}
    </div>
  );
}
