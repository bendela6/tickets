import websocketPlugin from '@fastify/websocket';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AgentDriver } from './driver';
import type { ClientFrame, ServerFrame, Subscriber } from './types';

// Close code for "no such live session". Distinct from a normal close (1000) and
// an abnormal drop (1006), so the browser client can tell a dead session apart
// from a flaky network and decide NOT to auto-reconnect. 4000-4999 is the range
// reserved for application use by the WebSocket spec.
const UNKNOWN_SESSION_CODE = 4404;

// One route bridges a browser WebSocket to the Agent Driver: the socket is
// just another Subscriber, so the driver stays transport-agnostic and
// unit-testable. The socket owns nothing — closing it detaches but never
// closes the run.
//
// Registered inside an encapsulated child plugin (awaited there) so the
// websocket plugin's onRoute hook is installed before the route is declared;
// declaring a `{ websocket: true }` route before that hook exists silently
// produces a plain HTTP route. This lets buildApp stay synchronous.
export function registerAgentSocket(app: FastifyInstance, context: { driver: AgentDriver }): void {
  const { driver } = context;

  app.register(async (instance) => {
    await instance.register(websocketPlugin);

    instance.get(
      '/api/agent/sessions/:id/socket',
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
              if (!driver.has(id)) {
                socket.close(UNKNOWN_SESSION_CODE, 'unknown session');
                return;
              }
              attached = true;
              // attach replays persisted messages > lastSeq, emits replay_done,
              // then promotes this subscriber to live.
              void driver.attach(id, sub, frame.lastSeq ?? 0);
              return;
            }
            case 'prompt':
              // Start a follow-up turn.
              if (attached) driver.prompt(id, frame.text);
              return;
            case 'permission':
              // Resolve a parked canUseTool promise.
              if (attached) driver.respondToPermission(id, frame.requestId, frame.result, frame.reason);
              return;
            case 'interrupt':
              // run.interrupt(), not a process kill — that is the stop route.
              if (attached) driver.interrupt(id);
              return;
            default:
              return;
          }
        });

        socket.on('close', () => driver.detach(id, sub));
        socket.on('error', () => driver.detach(id, sub));
      },
    );
  });
}
