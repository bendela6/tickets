import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useAiSession } from '../../api/use-ai-session';
import { useCreateAiSession } from '../../api/use-create-ai-session';
import { useStopAiSession } from '../../api/use-stop-ai-session';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../../ui/menu';
import { SessionStatusPill } from '../../ui/session-status-pill';
import { TerminalFrame } from './terminal-frame';
import { currentThemeName, terminalTheme } from './terminal-theme';
import { useSessionSocket } from './use-session-socket';

export function AiSessionScreen({ sessionId }: { sessionId: number }) {
  const navigate = useNavigate();
  const session = useAiSession(sessionId);
  const stop = useStopAiSession();
  const createSession = useCreateAiSession();

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
    fit.fit();
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

  const socket = useSessionSocket(sessionId, {
    onData: (data) => {
      const term = termRef.current;
      if (term) term.write(data);
      else pendingRef.current.push(data);
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

  function handleRestart() {
    if (!data) return;
    createSession.mutate(
      { kind: 'terminal', workspaceId: data.workspaceId, title: data.title },
      {
        onSuccess: (created) =>
          void navigate({ to: '/ai/$sessionId', params: { sessionId: String(created.id) } }),
      },
    );
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
              <SessionStatusPill status={status} exitCode={exitCode} />
              {socket.conn !== 'ended' ? (
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
                    <MenuItem
                      destructive
                      disabled={stop.isPending}
                      onSelect={() => {
                        if (window.confirm('End this session? The process will be stopped.')) {
                          stop.mutate(sessionId);
                        }
                      }}
                    >
                      End session
                    </MenuItem>
                  </MenuContent>
                </Menu>
              ) : null}
            </div>
          }
        >
          <div ref={containerRef} className="h-full w-full" />
        </TerminalFrame>
      </div>
    </div>
  );
}
