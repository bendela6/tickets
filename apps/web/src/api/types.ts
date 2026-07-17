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

// ── AI sessions (E1) ─────────────────────────────────────────────────────────

export type SessionKind = 'terminal' | 'agent';
export type SessionStatus =
  | 'starting'
  | 'running'
  | 'idle'
  | 'awaiting_input'
  | 'interrupted'
  | 'exited'
  | 'failed'
  | 'live'
  | 'disconnected';
export type RunnerKind = 'local' | 'container';

export interface AiWorkspace {
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

export interface AiSession {
  id: number;
  kind: SessionKind;
  title: string;
  workspaceId: number;
  agentId: number | null;
  itemId: number | null;
  parentSessionId: number | null;
  status: SessionStatus;
  providerSessionId: string | null;
  cwd: string | null;
  worktreePath: string | null;
  exitCode: number | null;
  costUsd: string | null;
  startedBy: number | null;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  archivedAt: string | null;
}

export interface CreateAiWorkspaceInput {
  name: string;
  path: string;
}

export interface CreateAiSessionInput {
  kind?: SessionKind;
  workspaceId?: number;
  agentId?: number;
  title?: string;
  command?: string;
  maxBudgetUsd?: number;
  cols?: number;
  rows?: number;
}

// Mirror of the API's normalized agent event union (apps/api ai/types.ts). The
// UI only ever sees these — never which provider produced them.
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

export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan'
  | 'dontAsk'
  | 'auto';

export interface AiAgent {
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
  defaultWorkspaceId: number | null;
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

export interface AiProvider {
  key: string;
  capabilities: ProviderCapabilities;
  models: ModelInfo[];
}

export interface CreateAiAgentInput {
  key: string;
  name: string;
  providerKey: string;
  model: string;
  systemPrompt?: string;
  allowedTools?: string[];
  permissionMode?: PermissionMode;
  effort?: string;
  defaultWorkspaceId?: number;
}

export interface PatchAiAgentInput {
  id: number;
  name?: string;
  model?: string;
  systemPrompt?: string | null;
  allowedTools?: string[];
  permissionMode?: PermissionMode;
  effort?: string | null;
  defaultWorkspaceId?: number | null;
  archived?: boolean;
}
