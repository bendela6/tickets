import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { SignalsClient } from '@bendela6/signals-node';
import { getActor, type ToolContext } from './actor';
import { environment } from './environment';
import { initMcpSignals } from './signals';
import { registerAddComment } from './tools/add-comment';
import { registerCreateTicket } from './tools/create-ticket';
import { registerDispatchAgent } from './tools/dispatch-agent';
import { registerGetBoard } from './tools/get-board';
import { registerGetTicket } from './tools/get-ticket';
import { registerLinkTickets } from './tools/link-tickets';
import { registerListProjects } from './tools/list-projects';
import { registerListTicketEvents } from './tools/list-ticket-events';
import { registerRemoveLink } from './tools/remove-link';
import { registerSearchTickets } from './tools/search-tickets';
import { registerUpdateTicket } from './tools/update-ticket';

// The stdio transport is the server's lifeline: a crash here silently removes
// every tool from the client session (stdio servers are never reconnected).
// Log and keep running; individual tool calls surface their own errors.
// `mcpSignals` starts null and is populated once initMcpSignals() resolves
// (deferred until after connect(), see below) — an error caught before then
// is still logged to stderr but not reported to Signals.
let mcpSignals: SignalsClient | null = null;
process.on('uncaughtException', (error) => {
  console.error('tickets mcp: uncaughtException', error);
  mcpSignals?.captureError(error, { mechanism: 'uncaught-exception' });
});
process.on('unhandledRejection', (reason) => {
  console.error('tickets mcp: unhandledRejection', reason);
  mcpSignals?.captureError(reason, { mechanism: 'unhandled-rejection' });
});

// No network I/O before connect() — the actor resolves lazily on first write.
const context: ToolContext = { getActor };

const server = new McpServer({ name: 'tickets', version: '0.1.0' });
registerListProjects(server);
registerGetBoard(server);
registerGetTicket(server);
registerSearchTickets(server);
registerListTicketEvents(server);
registerCreateTicket(server, context);
registerUpdateTicket(server, context);
registerAddComment(server, context);
registerLinkTickets(server, context);
registerRemoveLink(server, context);
registerDispatchAgent(server, context);

await server.connect(new StdioServerTransport());
// stdout belongs to the protocol — log to stderr only
console.error(
  `tickets mcp ready (api: ${environment.apiUrl}, actor "${environment.actorName}" resolves on first write)`,
);

// Signals self-registration is network I/O — deferred until after connect()
// so it can never delay the client attaching to this server, and
// fire-and-forget so a slow/down collector never blocks anything either.
void initMcpSignals().then((client) => {
  mcpSignals = client;
});
