import { useState, type ReactNode } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { ActivityRail } from './activity-rail';
import { BrandMark } from './brand-mark';
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // The session viewer routes are split by kind (/terminals/$sessionId,
  // /agents/$sessionId), so the path alone determines the mode — no session
  // lookup needed any more.
  const mode = modeForPath(pathname);

  // Terminals are the only session kind created from this shell's "New"
  // affordance (a dispatched agent session navigates itself); it always opens
  // under /terminals/$sessionId.
  const onNavigateSession = (sessionId: number) => {
    setMobileNavOpen(false);
    void navigate({ to: '/terminals/$sessionId', params: { sessionId: String(sessionId) } });
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
    <div className="flex h-screen flex-col bg-gray-1 font-sans text-gray-12 md:flex-row">
      {/* Mobile top bar */}
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b-1 border-gray-6 bg-gray-1 px-2 md:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(true)}
          className="inline-flex size-9 items-center justify-center rounded-lg text-16 text-gray-11 hover:bg-surface-inset"
        >
          ☰
        </button>
        <BrandMark size={18} />
        <span className="font-mono text-15 font-600 text-gray-12">tickets</span>
      </div>

      {/* Desktop: rail + panel */}
      <div className="hidden md:flex">
        <ActivityRail mode={mode} />
        <div className="flex w-56 flex-none flex-col overflow-y-auto border-r-1 border-gray-6">{panel}</div>
      </div>

      {/* Mobile slide-over: rail row on top + panel */}
      {mobileNavOpen ? (
        <div className="md:hidden">
          <div aria-hidden className="fixed inset-0 z-40 bg-black/20" onClick={() => setMobileNavOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 bg-gray-1 shadow-lg">
            <ActivityRail mode={mode} onNavigate={() => setMobileNavOpen(false)} />
            <div className="flex flex-1 flex-col overflow-y-auto">{panel}</div>
          </aside>
        </div>
      ) : null}

      <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
