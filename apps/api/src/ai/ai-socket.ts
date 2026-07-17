import websocketPlugin from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Supervisor } from './supervisor';
import type { ClientFrame, ServerFrame, Subscriber } from './types';

// Close code for "no such live session". Distinct from a normal close (1000) and
// an abnormal drop (1006), so the browser client can tell a dead session apart
// from a flaky network and decide NOT to auto-reconnect. 4000-4999 is the range
// reserved for application use by the WebSocket spec.
const UNKNOWN_SESSION_CODE = 4404;

// The API's first Fastify plugin. One route bridges a browser WebSocket to the
// Session Supervisor: the socket is just another Subscriber, so the supervisor
// stays transport-agnostic and unit-testable. The socket owns nothing — closing
// it detaches but never kills the process.
//
// Registered inside an encapsulated child plugin (awaited there) so the
// websocket plugin's onRoute hook is installed before the route is declared;
// declaring a `{ websocket: true }` route before that hook exists silently
// produces a plain HTTP route. This lets buildApp stay synchronous.
export function registerAiSocket(app: FastifyInstance, context: { supervisor: Supervisor }): void {
  const { supervisor } = context;

  app.register(async (instance) => {
    await instance.register(websocketPlugin);

    instance.get(
      '/api/ai/sessions/:id/socket',
      { websocket: true },
      (socket, req: FastifyRequest) => {
        const id = Number((req.params as { id: string }).id);

        const sub: Subscriber = {
          send: (frame: ServerFrame) => {
            if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(frame));
          },
          close: () => socket.close(),
        };

        let attached = false;

        socket.on('message', (raw: Buffer) => {
          let frame: ClientFrame;
          try {
            frame = JSON.parse(raw.toString()) as ClientFrame;
          } catch {
            return; // ignore malformed frames rather than tearing down the socket
          }

          switch (frame.type) {
            case 'attach': {
              if (attached) return; // one attach per socket
              if (!supervisor.has(id)) {
                socket.close(UNKNOWN_SESSION_CODE, 'unknown session');
                return;
              }
              attached = true;
              // attach replays persisted output > lastSeq, emits replay_done,
              // then promotes this subscriber to live.
              void supervisor.attach(id, sub, frame.lastSeq ?? 0);
              return;
            }
            case 'input':
              if (attached) supervisor.write(id, frame.data);
              return;
            case 'resize':
              if (attached) supervisor.resize(id, frame.cols, frame.rows);
              return;
            case 'prompt':
              // Agent: start a follow-up turn.
              if (attached) supervisor.prompt(id, frame.text);
              return;
            case 'permission':
              // Agent: resolve a parked canUseTool promise (E3 UI).
              if (attached) supervisor.respondToPermission(id, frame.requestId, frame.result, frame.reason);
              return;
            case 'interrupt':
              // Kind-aware: Ctrl-C to a terminal's foreground process, or
              // run.interrupt() for an agent turn. Neither kills the session —
              // that is DELETE /sessions.
              if (attached) supervisor.interrupt(id);
              return;
            default:
              return;
          }
        });

        socket.on('close', () => supervisor.detach(id, sub));
        socket.on('error', () => supervisor.detach(id, sub));
      },
    );
  });
}
