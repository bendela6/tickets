import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ensureActor } from './actor';
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

const context = await ensureActor();

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
console.error(`tickets mcp ready (actor: ${context.actorName} #${context.actorId})`);
