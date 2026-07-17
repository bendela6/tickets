import type { AgentEvent } from './types';

// How a persona decides whether a tool call needs a human — mirrors the Claude
// Agent SDK's PermissionMode. Same set as the DB permission_mode enum.
export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan'
  | 'dontAsk'
  | 'auto';

export interface ModelInfo {
  id: string; // e.g. 'claude-opus-4-8'
  label: string;
  contextWindow: number;
}

// Flags let the UI degrade honestly: a local model with no permission callback
// hides the approve/deny card and the resume affordance rather than showing dead
// controls.
export interface ProviderCapabilities {
  permissions: boolean; // can pause mid-run for approval?
  resume: boolean; // can continue a prior session?
  mcp: boolean;
  subagents: boolean;
}

// What the supervisor hands a provider to start an agent turn.
export interface RunSpec {
  cwd: string;
  model: string;
  systemPrompt?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode: PermissionMode;
  mcpServers?: Record<string, unknown>;
  maxBudgetUsd?: number;
  resumeSessionId?: string;
  // Free-form provider knobs (e.g. reasoning effort, personas) — the provider
  // interprets what it understands and ignores the rest.
  config?: Record<string, unknown>;
}

// A live handle the supervisor holds for an agent session — the AgentRun analogue
// of PtyHandle. `events` is the normalized stream; `send` starts a follow-up
// turn; `respondToPermission` unblocks a parked canUseTool promise (E3).
export interface AgentRun {
  events: AsyncIterable<AgentEvent>;
  send(text: string): Promise<void>;
  respondToPermission(id: string, result: 'allow' | 'deny', reason?: string): Promise<void>;
  interrupt(): Promise<void>;
  close(): void;
}

// A provider is a code-registered kind of agent (not a DB row): adding one is a
// deploy. Every provider normalizes its native output into AgentEvent.
export interface AgentProvider {
  key: string; // 'claude' | 'codex' | 'gemini' | 'ollama'
  models(): ModelInfo[];
  capabilities: ProviderCapabilities;
  start(spec: RunSpec): AgentRun;
}
