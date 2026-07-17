import type { PermissionMode, RunSpec } from './agent-types';

// The persona fields the RunSpec builder reads — a structural subset of the
// agent.agents row, so the builder is decoupled from drizzle and unit-testable
// with plain objects.
export interface AgentSpecInput {
  model: string;
  systemPrompt: string | null;
  allowedTools: unknown;
  disallowedTools: unknown;
  permissionMode: PermissionMode;
  mcpServers: unknown;
  effort: string | null;
  config: unknown;
}

// Turn a persona + a resolved cwd into the RunSpec the provider starts. jsonb
// columns arrive as `unknown`; normalize the tool lists to string[] and merge
// effort into the free-form config the provider interprets.
export function buildRunSpec(
  agent: AgentSpecInput,
  cwd: string,
  opts: { maxBudgetUsd?: number; resumeSessionId?: string } = {},
): RunSpec {
  const config: Record<string, unknown> = {
    ...(isRecord(agent.config) ? agent.config : {}),
    ...(agent.effort ? { effort: agent.effort } : {}),
  };
  return {
    cwd,
    model: agent.model,
    permissionMode: agent.permissionMode,
    ...(agent.systemPrompt ? { systemPrompt: agent.systemPrompt } : {}),
    ...(stringArray(agent.allowedTools) ? { allowedTools: stringArray(agent.allowedTools) } : {}),
    ...(stringArray(agent.disallowedTools)
      ? { disallowedTools: stringArray(agent.disallowedTools) }
      : {}),
    ...(isRecord(agent.mcpServers) && Object.keys(agent.mcpServers).length > 0
      ? { mcpServers: agent.mcpServers }
      : {}),
    ...(opts.maxBudgetUsd != null ? { maxBudgetUsd: opts.maxBudgetUsd } : {}),
    ...(opts.resumeSessionId ? { resumeSessionId: opts.resumeSessionId } : {}),
    config,
  };
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((v): v is string => typeof v === 'string');
  return strings.length > 0 ? strings : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
