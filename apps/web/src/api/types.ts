export interface Project {
  id: number;
  key: string;
  name: string;
  ticketPrefix: string;
  createdAt: string;
}

export type UserKind = 'human' | 'agent';

export interface User {
  id: number;
  name: string;
  email: string | null;
  kind: UserKind;
  archivedAt: string | null;
  createdAt: string;
}

export interface TicketTypeConfig {
  color?: string;
}

export interface TicketType {
  id: number;
  projectId: number;
  key: string;
  label: string;
  config: TicketTypeConfig;
  position: number;
  archivedAt: string | null;
  createdAt: string;
}

export interface TypeField {
  ticketTypeId: number;
  fieldId: number;
  position: number;
  required: boolean;
}

export type StatusKind = 'todo' | 'active' | 'blocked' | 'done' | 'dropped';

export interface StatusConfig {
  color?: string;
  initial?: boolean;
  description?: string;
}

export interface Status {
  id: number;
  projectId: number;
  key: string;
  label: string;
  kind: StatusKind;
  config: StatusConfig;
  position: number;
  archivedAt: string | null;
  createdAt: string;
}

export interface Transition {
  id: number;
  fromStatusId: number;
  toStatusId: number;
  ticketTypeId: number | null;
  config: Record<string, unknown>;
}

export type FieldType =
  'text' | 'number' | 'date' | 'boolean' | 'json' | 'select' | 'multi_select' | 'status';

export interface FieldConfig {
  widget?: string;
  description?: string;
}

export interface FieldOptionConfig {
  color?: string;
}

export interface FieldOption {
  id: number;
  value: string;
  label: string;
  config: FieldOptionConfig;
  position: number;
  archivedAt: string | null;
}

export interface Field {
  id: number;
  projectId: number;
  key: string;
  label: string;
  type: FieldType;
  system: boolean;
  config: FieldConfig;
  archivedAt: string | null;
  createdAt: string;
  options: FieldOption[];
}

export interface LinkType {
  id: number;
  projectId: number;
  key: string;
  label: string;
  inverseLabel: string;
  directional: boolean;
  position: number;
  archivedAt: string | null;
}

export interface View {
  id: number;
  projectId: number;
  name: string;
  config: Record<string, unknown>;
  position: number;
  archivedAt: string | null;
  createdAt: string;
}

export interface TicketComment {
  id: number;
  ticketId: number;
  authorId: number;
  body: string;
  createdAt: string;
}

export interface TicketLink {
  id: number;
  linkTypeId: number;
  sourceTicketId: number;
  targetTicketId: number;
}

export interface BoardTicket {
  id: number;
  number: number;
  typeId: number;
  parentId: number | null;
  createdBy: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  values: Record<string, unknown>;
  comments: TicketComment[];
  links: TicketLink[];
}

export interface Board {
  project: Project;
  users: User[];
  types: TicketType[];
  typeFields: TypeField[];
  statuses: Status[];
  transitions: Transition[];
  fields: Field[];
  linkTypes: LinkType[];
  views: View[];
  tickets: BoardTicket[];
}

export interface ListMeta {
  skip: number;
  take: number;
  total: number;
  sort: string | null;
}

export interface TicketEvent {
  id: number;
  ticketId: number;
  actorId: number;
  actorName: string | null;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface TicketEventsResponse {
  data: TicketEvent[];
  meta: ListMeta;
}

export interface UsersResponse {
  data: User[];
  meta: ListMeta;
}

export interface CreatedTicket {
  id: number;
  projectId: number;
  number: number;
  typeId: number;
  parentId: number | null;
  createdBy: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatchTicketResult {
  id: number;
  updatedAt: string;
}

export interface CreateTicketInput {
  projectKey: string;
  actorId: number;
  typeKey: string;
  parentId?: number | null;
  values: Record<string, unknown>;
}

export interface PatchTicketInput {
  ticketId: number;
  actorId: number;
  expectedUpdatedAt: string;
  typeKey?: string;
  parentId?: number | null;
  archived?: boolean;
  values?: Record<string, unknown>;
}

export interface CreateCommentInput {
  ticketId: number;
  authorId: number;
  body: string;
}

export interface CreateLinkInput {
  actorId: number;
  linkTypeKey: string;
  sourceTicketId: number;
  targetTicketId: number;
}

export interface DeleteLinkInput {
  linkId: number;
  actorId: number;
}

export interface CreateUserInput {
  name: string;
  kind?: UserKind;
}

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
  ticketId: number | null;
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
