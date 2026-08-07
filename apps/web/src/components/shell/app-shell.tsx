import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Drawer, SidePanel, useIsNarrow } from '@tickets/ui';
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
  // `useRouterState` (already used above for `pathname`) rather than
  // `schemaRoute.useSearch()`, which throws when the active route isn't
  // `/schema` — this shell renders across every route.
  const search = useRouterState({ select: (s) => s.location.search as { database?: string } });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // The mobile nav has to be gated in JS, not by `md:hidden`: a class only
  // reaches the drawer's own panel, leaving the scrim painted, the focus trap
  // armed and `pointer-events: none` on <body> when a phone rotates to
  // landscape or a narrow window is widened with the nav open — the desktop UI
  // it uncovers would read as frozen. `(max-width: 767px)` is the exact
  // complement of Tailwind's `md:`, so the two agree on where mobile ends.
  const narrow = useIsNarrow('md');
  // Nothing else ever clears the flag on a viewport change, so a nav left open
  // on a phone would spring back open the next time the window narrowed, with
  // no gesture behind it.
  useEffect(() => {
    if (!narrow) setMobileNavOpen(false);
  }, [narrow]);

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
      schemaDatabase={search.database}
    />
  );

  return (
    <div className="flex h-screen flex-col bg-gray-1 font-sans text-gray-12 md:flex-row">
      {/* Mobile top bar */}
      <div className="flex h-48 shrink-0 items-center gap-6 border-b-1 border-gray-6 bg-gray-1 px-8 md:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(true)}
          className="inline-flex size-36 items-center justify-center rounded-8 text-16 text-gray-11 hover:bg-surface-inset"
        >
          ☰
        </button>
        <BrandMark size={18} />
        <span className="font-mono text-15 font-600 text-gray-12">tickets</span>
      </div>

      {/* Desktop: rail + resizable panel */}
      <div className="hidden md:flex">
        <ActivityRail mode={mode} />
        <SidePanel
          label="Navigation"
          storageKey="app-nav"
          defaultWidth={224}
          minWidth={180}
          maxWidth={400}
          collapsible
        >
          {panel}
        </SidePanel>
      </div>

      {/* Mobile: the same rail and panel, as an overlay */}
      {narrow ? (
        <Drawer
          open={mobileNavOpen}
          onOpenChange={setMobileNavOpen}
          side="left"
          size="sm"
          label="Navigation"
          className="flex-row bg-gray-1"
        >
          <ActivityRail mode={mode} onNavigate={() => setMobileNavOpen(false)} />
          <div className="flex flex-1 flex-col overflow-y-auto">{panel}</div>
        </Drawer>
      ) : null}

      <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
