import type { ReactNode } from 'react';
import { Button, cn } from '@tickets/ui';
import { exitCodeTone } from '../../domain/session-status';
import type { ConnState } from '../session/use-session-socket';

// Re-exported so callers (e.g. terminal-display.ts) can depend on this module
// without reaching into the shared socket module directly.
export type { ConnState };

const INDICATOR: Record<ConnState, { dot: string; label: string; pulse?: boolean }> = {
  connecting: { dot: 'bg-gray-9', label: 'connecting…' },
  live: { dot: 'bg-green-9', label: 'live' },
  reconnecting: { dot: 'bg-orange-9', label: 'reconnecting…', pulse: true },
  ended: { dot: 'bg-gray-9', label: 'ended' },
};

function ConnIndicator({ state }: { state: ConnState }) {
  const it = INDICATOR[state];
  return (
    <span className="inline-flex items-center gap-1.5 font-sans text-meta text-gray-11">
      <span
        aria-hidden
        className={cn('size-2 rounded-full', it.dot, it.pulse && 'animate-ai-pulse')}
      />
      {it.label}
    </span>
  );
}

// Chrome around the xterm canvas (screen 10): a title bar carrying the session
// title, workspace path, connection indicator, and danger action (Stop), and a
// footer that reports the exit code and any scrollback-truncation notice. The
// canvas region is painted with the terminal's own background so the chrome
// blends into it seamlessly across light/dark.
export function TerminalFrame({
  title,
  workspacePath,
  conn,
  exitCode,
  truncated,
  background,
  actions,
  onRestart,
  children,
}: {
  title: string;
  workspacePath?: string | null;
  conn: ConnState;
  exitCode?: number | null;
  truncated?: boolean;
  background?: string;
  actions?: ReactNode;
  onRestart?: () => void;
  children: ReactNode;
}) {
  const ended = conn === 'ended';
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-6 bg-surface-raised">
      <div className="flex items-center gap-3 border-b border-gray-6 px-3.5 py-2">
        <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
          <span className="truncate font-sans text-ui font-medium text-gray-12">{title}</span>
          {workspacePath ? (
            <span className="truncate font-mono text-meta text-gray-9">{workspacePath}</span>
          ) : null}
        </div>
        <ConnIndicator state={conn} />
        {actions}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-2" style={{ background }}>
        {children}
      </div>

      {ended || truncated ? (
        <div className="flex items-center gap-3 border-t border-gray-6 px-3.5 py-2 font-sans text-meta">
          {ended ? (
            <span className="text-gray-11">
              {exitCode == null ? (
                'Session ended'
              ) : (
                <>
                  Exited with code{' '}
                  <span className={cn('font-mono', exitCodeTone(exitCode))}>{exitCode}</span>
                </>
              )}
            </span>
          ) : null}
          {truncated ? (
            <span className="text-gray-9">Earlier output was pruned from scrollback.</span>
          ) : null}
          <span className="flex-1" />
          {ended && onRestart ? (
            <Button size="sm" variant="secondary" onClick={onRestart}>
              Restart
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
