import { useState, type ReactNode } from 'react';
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import { useAiSessions } from '../../api/use-ai-sessions';
import { ActivityRail } from './activity-rail';
import { ModePanel } from './mode-panel';
import { modeForPath } from './mode-for-path';

export function AppShell({
  activeProjectKey,
  onNewTicket,
  children,
}: {
  activeProjectKey?: string;
  onNewTicket?: () => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const params = useParams({ strict: false }) as { sessionId?: string };
  const sessions = useAiSessions();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // For /ai/:id the mode follows the loaded session kind.
  const sessionKind =
    params.sessionId != null
      ? (sessions.data ?? []).find((s) => s.id === Number(params.sessionId))?.kind ?? null
      : null;
  const mode = modeForPath(pathname, sessionKind);

  const onNavigateSession = (sessionId: number) => {
    setMobileNavOpen(false);
    void navigate({ to: '/ai/$sessionId', params: { sessionId: String(sessionId) } });
  };

  const panel = (
    <ModePanel
      mode={mode}
      activeProjectKey={activeProjectKey}
      onNewTicket={onNewTicket}
      onNavigate={() => setMobileNavOpen(false)}
      onNavigateSession={onNavigateSession}
    />
  );

  return (
    <div className="flex h-screen flex-col bg-app font-sans text-ink md:flex-row">
      {/* Mobile top bar */}
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-hairline bg-app px-2 md:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(true)}
          className="inline-flex size-9 items-center justify-center rounded-[8px] text-[17px] text-ink-2 hover:bg-inset"
        >
          ☰
        </button>
        <span aria-hidden className="size-2.25 rounded-[2px] bg-accent" />
        <span className="font-mono text-[15px] font-semibold text-ink">tickets</span>
      </div>

      {/* Desktop: rail + panel */}
      <div className="hidden md:flex">
        <ActivityRail mode={mode} />
        <div className="flex w-56 flex-none flex-col overflow-y-auto border-r border-hairline">{panel}</div>
      </div>

      {/* Mobile slide-over: rail row on top + panel */}
      {mobileNavOpen ? (
        <div className="md:hidden">
          <div aria-hidden className="fixed inset-0 z-40 bg-black/20" onClick={() => setMobileNavOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 bg-app shadow-lg">
            <ActivityRail mode={mode} onNavigate={() => setMobileNavOpen(false)} />
            <div className="flex flex-1 flex-col overflow-y-auto">{panel}</div>
          </aside>
        </div>
      ) : null}

      <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
