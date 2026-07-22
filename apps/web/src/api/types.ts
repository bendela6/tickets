export interface Project { id: number; key: string; name: string; schemeId: number; itemPrefix: string; createdAt: string; }

export type UserKind = 'human' | 'agent';
export interface User { id: number; name: string; email: string | null; kind: UserKind; archivedAt: string | null; }

export interface ItemType {
  id: number; schemeId: number; key: string; label: string; position: number;
  config: { color?: string } & Record<string, unknown>;
  archivedAt: string | null;
}

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'option' | 'user' | 'json';
export interface Field {
  id: number; schemeId: number; key: string; label: string; type: FieldType;
  config: { multiple?: boolean; workflow?: boolean; format?: string } & Record<string, unknown>;
  optionSetId: number | null;
  archivedAt: string | null;
}

// A field placed on a type.
export interface ItemTypeField {
  itemTypeId: number; fieldId: number; position: number; required: boolean;
  configOverride: { allowedOptionIds?: number[] } | null;
}

export type StatusKind = 'todo' | 'active' | 'blocked' | 'done' | 'dropped';
export interface Option {
  id: number; optionSetId: number; value: string; label: string; position: number;
  kind: StatusKind | null;                       // null for non-workflow options
  config: { color?: string; icon?: string } & Record<string, unknown>;
  archivedAt: string | null;
}

export interface Transition {
  id: number; fieldId: number; itemTypeId: number | null;
  fromOptionId: number | null; toOptionId: number;
  config: { guard?: { requiresComment?: boolean; requiresField?: string } } | null;
}

export interface LinkType { id: number; itemTypeId: number; key: string; label: string; inverseLabel: string; directional: boolean; position: number; archivedAt: string | null; }
export interface LinkTypeTargetType { linkTypeId: number; targetTypeId: number; }
export interface View { id: number; projectId: number; name: string; config: Record<string, unknown>; }
export interface ItemTypeChildType { parentTypeId: number; childTypeId: number; }

export interface Comment { id: number; itemId: number; authorId: number; parentId: number | null; body: string; createdAt: string; }
export interface ItemLink { id: number; linkTypeId: number; sourceItemId: number; targetItemId: number; createdAt: string; }

export interface Item {
  id: number; number: number; typeId: number; parentId: number | null;
  createdBy: number; archivedAt: string | null; createdAt: string; updatedAt: string;
  values: Record<string, unknown>;               // fieldKey -> rendered (option value string, {id,name}, scalar, or array)
  comments: Comment[]; links: ItemLink[];
}

export interface Board {
  project: Project;
  types: ItemType[];
  fields: Field[];
  placements: ItemTypeField[];
  options: Option[];
  transitions: Transition[];
  linkTypes: LinkType[];
  targetTypes: LinkTypeTargetType[];
  views: View[];
  users: User[];
  childTypes: ItemTypeChildType[];
  items: Item[];
}

export interface ActivityEntry {
  id: number; itemId: number; eventId: number; kind: string;
  actorId: number; at: string; correlationId: string; summary: Record<string, unknown>;
}

// The envelope every mutation body carries.
export interface CommandEnvelope { commandId: string; actorId: number; }

export interface CreateItemInput { projectKey: string; actorId: number; typeKey: string; parentId?: number | null; values: Record<string, unknown>; }
export interface PatchItemInput { itemId: number; actorId: number; expectedUpdatedAt: string; parentId?: number | null; archived?: boolean; values?: Record<string, unknown>; }
export interface CreatedItem { id: number; number: number; typeId: number; parentId: number | null; createdBy: number; archivedAt: string | null; createdAt: string; updatedAt: string; }
export interface PatchItemResult { id: number; updatedAt: string; }
export interface CreateCommentInput { itemId: number; actorId: number; body: string; parentId?: number | null; }
export interface CreateLinkInput { actorId: number; linkTypeKey: string; sourceItemId: number; targetItemId: number; }
export interface DeleteLinkInput { linkId: number; actorId: number; }
export interface CreateUserInput { actorId: number; name: string; kind?: UserKind; }
export interface CreateProjectInput { actorId: number; key: string; name: string; itemPrefix: string; }

export interface ListMeta { total?: number }
export interface UsersResponse { data: User[] }
export interface ProjectsResponse { data: Project[] }

// ── Terminal + Agent sessions (post terminal/agent split) ────────────────────
//
// `terminal.sessions` and `agent.sessions` are separate tables with separate id
// sequences — a terminal and an agent can both be id 1. There is no `kind`
// discriminator any more; a session's kind is which table/endpoint it came
// from, so the two are modeled as entirely separate types below (never a
// union keyed on a bare id).

export type RunnerKind = 'local' | 'container';

// Shared: the one CRUD home for `core.workdirs` (owned by apps/api
// terminal/routes.ts, used by both subsystems). The old ai-subsystem
// workspaces route is gone.
export interface Workdir {
  id: number;
  name: string;
  path: string;
  runner: RunnerKind;
  containerName: string | null;
  gitRemote: string | null;
  defaultBranch: string | null;
  config: Record<string, unknown>;
  archivedAt: string | null;
  createdAt: string;
}

export interface WorkdirRoot {
  path: string;
  symbol: string;
  annotation: string;
}

export interface WorkdirDirEntry {
  name: string;
  path: string;
}

export interface WorkdirDirListing {
  path: string;
  parent: string | null;
  entries: WorkdirDirEntry[];
  error?: string;
}

export interface CreateWorkdirInput {
  name: string;
  path: string;
}

// ── Terminal ──────────────────────────────────────────────────────────────

// A PTY's lifecycle. `live` = attached and running; `disconnected` = the API
// restarted and the process died with it. No turn states — those are agent
// facts (see AgentSessionStatus).
export type TerminalStatus = 'starting' | 'live' | 'disconnected' | 'exited' | 'failed';

export interface TerminalSession {
  id: number;
  title: string;
  workdirId: number;
  cwd: string | null;
  status: TerminalStatus;
  exitCode: number | null;
  startedBy: number | null;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  archivedAt: string | null;
}

export interface CreateTerminalSessionInput {
  workdirId: number;
  title?: string;
  command?: string;
  cols?: number;
  rows?: number;
}

// ── Agent ─────────────────────────────────────────────────────────────────

// An agent turn's lifecycle. No live/disconnected — those are PTY facts.
export type AgentSessionStatus =
  | 'starting'
  | 'running'
  | 'idle'
  | 'awaiting_input'
  | 'interrupted'
  | 'exited'
  | 'failed';

export interface AgentSession {
  id: number;
  title: string;
  workdirId: number;
  agentId: number | null;
  itemId: number | null;
  parentSessionId: number | null;
  status: AgentSessionStatus;
  providerSessionId: string | null;
  cwd: string | null;
  worktreePath: string | null;
  costUsd: string | null;
  startedBy: number | null;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  archivedAt: string | null;
}

export interface CreateAgentSessionInput {
  agentId: number;
  workdirId?: number;
  parentSessionId?: number;
  itemId?: number;
  title?: string;
  maxBudgetUsd?: number;
}

// Mirror of the API's normalized agent event union (apps/api agent/types.ts).
// The UI only ever sees these — never which provider produced them.
export type AgentEvent =
  | { type: 'session_started'; providerSessionId: string }
  | { type: 'assistant_text'; text: string; parentToolUseId?: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown; parentToolUseId?: string }
  | { type: 'tool_result'; toolUseId: string; content: unknown; isError: boolean }
  | { type: 'permission_request'; id: string; toolName: string; input: unknown }
  | {
      type: 'result';
      costUsd: number;
      durationMs: number;
      isError: boolean;
      usage?: {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheCreationTokens: number;
      };
    }
  | { type: 'error'; message: string };

// Mirrors the Claude Agent SDK's PermissionMode. Exactly the 5 SDK values the
// agent.permission_mode enum carries — no legacy `auto`.
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';

// The persona library (agent.agents) — a reusable provider/model/prompt/tool
// config a session or dispatch runs with.
export interface Agent {
  id: number;
  userId: number;
  key: string;
  name: string;
  providerKey: string;
  model: string;
  systemPrompt: string | null;
  allowedTools: string[];
  disallowedTools: string[];
  permissionMode: PermissionMode;
  mcpServers: Record<string, unknown>;
  effort: string | null;
  defaultWorkdirId: number | null;
  config: Record<string, unknown>;
  archivedAt: string | null;
  createdAt: string;
}

export interface ProviderCapabilities {
  permissions: boolean;
  resume: boolean;
  mcp: boolean;
  subagents: boolean;
}

export interface ModelInfo {
  id: string;
  label: string;
  contextWindow: number;
}

export interface AgentProviderInfo {
  key: string;
  capabilities: ProviderCapabilities;
  models: ModelInfo[];
}

export interface CreateAgentInput {
  key: string;
  name: string;
  providerKey: string;
  model: string;
  systemPrompt?: string;
  allowedTools?: string[];
  permissionMode?: PermissionMode;
  effort?: string;
  defaultWorkdirId?: number;
}

export interface PatchAgentInput {
  id: number;
  name?: string;
  model?: string;
  systemPrompt?: string | null;
  allowedTools?: string[];
  permissionMode?: PermissionMode;
  effort?: string | null;
  defaultWorkdirId?: number | null;
  archived?: boolean;
}
