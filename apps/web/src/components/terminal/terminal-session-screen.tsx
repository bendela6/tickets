import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useArchiveTerminalSession, useStopTerminalSession } from '../../api/use-archive-terminal-session';
import { useRestartTerminalSession } from '../../api/use-restart-terminal-session';
import { useTerminalSession } from '../../api/use-terminal-session';
import type { TerminalStatus } from '../../api/types';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../ui/menu';
import { SessionStatusPill } from '../../ui/session-status-pill';
import { useSessionSocket } from '../session/use-session-socket';
import { terminalDisplay } from './terminal-display';
import { TerminalFrame } from './terminal-frame';
import { currentThemeName, terminalTheme } from './terminal-theme';
import { useTerminalActivity } from './use-terminal-activity';

// /terminals/:id — a real PTY rendered with xterm. There is no `kind` branch
// here any more: a terminal session is always a PTY (apps/api terminal/*),
// and the agent session screen (message stream + composer) lives entirely
// separately under components/agent/.
export function TerminalSessionScreen({ sessionId }: { sessionId: number }) {
  const navigate = useNavigate();
  const session = useTerminalSession(sessionId);
  const restartSession = useRestartTerminalSession();
  const stopSession = useStopTerminalSession();
  const archiveSession = useArchiveTerminalSession();
  // Output-pulse fallback for sessions without shell integration (OSC 133).
  const fallback = useTerminalActivity();

  // Bumped by Restart to force the socket to reconnect from seq 0 and replay
  // the continued transcript onto a freshly-reset terminal.
  const [restartEpoch, setRestartEpoch] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  // Output that arrives before the terminal has mounted (a network replay can
  // land in the same tick) is buffered here and flushed once xterm is ready.
  const pendingRef = useRef<string[]>([]);
  // Socket senders held in refs so the one-time xterm effect never goes stale.
  const sendInputRef = useRef<(data: string) => void>(() => {});
  const sendResizeRef = useRef<(cols: number, rows: number) => void>(() => {});

  // Set up xterm exactly once, BEFORE wiring the socket below, so termRef is
  // populated before the first output frame can arrive.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
      fontSize: 13,
      cursorBlink: true,
      theme: terminalTheme(currentThemeName()),
      scrollback: 10_000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    try {
      fit.fit();
    } catch {
      // fit throws if the container is momentarily 0-sized (e.g. hidden tab,
      // or an unmeasured jsdom container in tests).
    }
    termRef.current = term;

    for (const chunk of pendingRef.current) term.write(chunk);
    pendingRef.current = [];

    term.onData((data) => sendInputRef.current(data));

    const doFit = () => {
      try {
        fit.fit();
      } catch {
        // fit throws if the container is momentarily 0-sized (e.g. hidden tab).
        return;
      }
      sendResizeRef.current(term.cols, term.rows);
    };
    doFit();

    const resizeObserver = new ResizeObserver(doFit);
    resizeObserver.observe(container);

    // Re-theme live when the app's light/dark toggle flips <html data-theme>.
    const themeObserver = new MutationObserver(() => {
      term.options.theme = terminalTheme(currentThemeName());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, []);

  const socket = useSessionSocket<TerminalStatus>(sessionId, {
    basePath: '/api/terminal/sessions',
    reconnectKey: restartEpoch,
    onData: (data) => {
      const term = termRef.current;
      if (term) term.write(data);
      else pendingRef.current.push(data);
      fallback.ping();
    },
  });
  sendInputRef.current = socket.sendInput;
  sendResizeRef.current = socket.sendResize;

  // Focus the terminal once it is live so typing lands immediately.
  useEffect(() => {
    if (socket.conn === 'live') termRef.current?.focus();
  }, [socket.conn]);

  const data = session.data;
  const status = socket.status ?? data?.status ?? 'starting';
  const exitCode = socket.exitCode ?? data?.exitCode ?? null;
  // Shell-integrated sessions get precise busy/command from the server's OSC
  // 133 activity frames; other shells fall back to the output-pulse heuristic.
  const busy = socket.integrated ? (socket.activity?.busy ?? false) : fallback.busy;
  const cmd = socket.integrated ? socket.activity?.command : undefined;
  const display = terminalDisplay(socket.conn, status, busy, cmd);

  // Respawn on the SAME record: no navigation, no new session. Bump
  // restartEpoch so the socket reconnects and replays from the last seq the
  // terminal already showed — the divider + fresh shell append below the
  // existing scrollback (the new shell clears its own viewport on launch).
  function handleRestart() {
    restartSession.mutate(sessionId, {
      onSuccess: () => setRestartEpoch((e) => e + 1),
    });
  }

  return (
    <div className="flex h-full flex-col gap-3 px-6 py-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void navigate({ to: '/terminals' })}
          className="font-sans text-meta text-ink-3 hover:text-ink-2"
        >
          ← sessions
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <TerminalFrame
          title={data?.title ?? `session #${sessionId}`}
          workspacePath={data?.cwd}
          conn={socket.conn}
          exitCode={exitCode}
          truncated={socket.truncated}
          background={terminalTheme(currentThemeName()).background}
          onRestart={handleRestart}
          actions={
            <div className="flex items-center gap-2">
              <SessionStatusPill
                status={display.status}
                label={display.label}
                kind="terminal"
                exitCode={exitCode}
              />
              <Menu>
                <MenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Session actions"
                    className="inline-flex size-6 items-center justify-center rounded-md border border-hairline bg-raised font-sans text-ink-2 hover:border-control"
                  >
                    ⋯
                  </button>
                </MenuTrigger>
                <MenuContent align="end">
                  {/* Ending stops the PTY and leaves the session listed as
                      exited, to read its output; archiving is the separate act
                      that hides it. */}
                  {socket.conn !== 'ended' ? (
                    <MenuItem
                      destructive
                      disabled={stopSession.isPending}
                      onSelect={() => {
                        if (window.confirm('End this session? The process will be stopped.')) {
                          stopSession.mutate(sessionId);
                        }
                      }}
                    >
                      End session
                    </MenuItem>
                  ) : (
                    <MenuItem
                      disabled={archiveSession.isPending}
                      onSelect={() => archiveSession.mutate(sessionId)}
                    >
                      Archive
                    </MenuItem>
                  )}
                </MenuContent>
              </Menu>
            </div>
          }
        >
          <div ref={containerRef} className="h-full w-full" />
        </TerminalFrame>
      </div>
    </div>
  );
}
