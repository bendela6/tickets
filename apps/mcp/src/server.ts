import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getActor, type ToolContext } from './actor';
import { environment } from './environment';
import { registerAddComment } from './tools/add-comment';
import { registerCreateTicket } from './tools/create-ticket';
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
process.on('uncaughtException', (error) => {
  console.error('tickets mcp: uncaughtException', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('tickets mcp: unhandledRejection', reason);
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

await server.connect(new StdioServerTransport());
// stdout belongs to the protocol — log to stderr only
console.error(
  `tickets mcp ready (api: ${environment.apiUrl}, actor "${environment.actorName}" resolves on first write)`,
);
