import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiFetch } from '../api-client';
import { runTool } from '../helpers/run-tool';
import { toText } from '../helpers/to-text';
import type { Project } from '../types';

export function registerListProjects(server: McpServer) {
  server.registerTool(
    'list_projects',
    {
      description:
        'List all ticket projects (key, name, ticket prefix). Start here when you do not know the project key.',
      inputSchema: {},
    },
    () =>
      runTool('list_projects', async () => {
        const projects = await apiFetch<{ data: Project[] }>('/api/projects');
        return toText(
          projects.data.map((project) => ({
            key: project.key,
            name: project.name,
            ticketPrefix: project.ticketPrefix,
          })),
        );
      }),
  );
}
