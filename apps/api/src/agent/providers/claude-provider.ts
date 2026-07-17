import {
  query as sdkQuery,
  type CanUseTool,
  type Options,
  type PermissionResult,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { AgentProvider, AgentRun, ModelInfo, RunSpec } from '../agent-types';
import type { AgentEvent } from '../types';
import { mapSdkMessage } from './map-sdk-message';

// The signature of the SDK's query(), injectable so tests drive a fake stream
// without an API key or a spawned subprocess.
export type QueryFn = typeof sdkQuery;

const CLAUDE_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8', contextWindow: 1_000_000 },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', contextWindow: 1_000_000 },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', contextWindow: 200_000 },
];

// The first provider. Wraps the Claude Agent SDK: RunSpec → query() options,
// SDKMessage → AgentEvent (via mapSdkMessage), and canUseTool → a parked
// permission_request the driver resolves. Needs ANTHROPIC_API_KEY in the
// environment (third-party use cannot ride a claude.ai login).
export function createClaudeProvider(deps: { query?: QueryFn } = {}): AgentProvider {
  const runQuery = deps.query ?? sdkQuery;
  return {
    key: 'claude',
    models: () => CLAUDE_MODELS,
    capabilities: { permissions: true, resume: true, mcp: true, subagents: true },
    start: (spec) => startClaudeRun(runQuery, spec),
  };
}

function startClaudeRun(runQuery: QueryFn, spec: RunSpec): AgentRun {
  const input = createAsyncQueue<SDKUserMessage>();
  const events = createAsyncQueue<AgentEvent>();
  // Parked canUseTool promises, keyed by the id we emit on permission_request.
  const pending = new Map<string, { resolve: (r: PermissionResult) => void; input: unknown }>();
  let permSeq = 0;

  const canUseTool: CanUseTool = (toolName, toolInput) => {
    const id = `perm_${++permSeq}`;
    events.push({ type: 'permission_request', id, toolName, input: toolInput });
    return new Promise<PermissionResult>((resolve) => pending.set(id, { resolve, input: toolInput }));
  };

  const options: Options = {
    cwd: spec.cwd,
    model: spec.model,
    permissionMode: spec.permissionMode,
    canUseTool,
    ...(spec.systemPrompt ? { systemPrompt: spec.systemPrompt } : {}),
    ...(spec.allowedTools ? { allowedTools: spec.allowedTools } : {}),
    ...(spec.disallowedTools ? { disallowedTools: spec.disallowedTools } : {}),
    ...(spec.mcpServers ? { mcpServers: spec.mcpServers as Options['mcpServers'] } : {}),
    ...(spec.maxBudgetUsd != null ? { maxBudgetUsd: spec.maxBudgetUsd } : {}),
    ...(spec.resumeSessionId ? { resume: spec.resumeSessionId } : {}),
  };

  const q = runQuery({ prompt: input.iterable, options });

  // Pump the SDK stream into our normalized event queue. Persist-before-broadcast
  // and seq assignment happen upstream in the driver.
  void (async () => {
    try {
      for await (const msg of q) {
        for (const event of mapSdkMessage(msg)) events.push(event);
      }
    } catch (err) {
      events.push({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      events.end();
    }
  })();

  return {
    events: events.iterable,
    async send(text) {
      input.push(userMessage(text));
    },
    async respondToPermission(id, result, reason) {
      const parked = pending.get(id);
      if (!parked) return;
      pending.delete(id);
      parked.resolve(
        result === 'allow'
          ? { behavior: 'allow', updatedInput: parked.input as Record<string, unknown> }
          : { behavior: 'deny', message: reason ?? 'denied by user' },
      );
    },
    async interrupt() {
      await q.interrupt();
    },
    close() {
      input.end();
      void q.return(undefined);
    },
  };
}

function userMessage(text: string): SDKUserMessage {
  return {
    type: 'user',
    parent_tool_use_id: null,
    message: { role: 'user', content: text },
  } as SDKUserMessage;
}

// A pushable async iterable: the input side feeds SDKUserMessages into query();
// the events side feeds AgentEvents out.
function createAsyncQueue<T>() {
  const values: T[] = [];
  const waiters: ((r: IteratorResult<T>) => void)[] = [];
  let ended = false;
  return {
    push(value: T) {
      if (ended) return;
      const waiter = waiters.shift();
      if (waiter) waiter({ value, done: false });
      else values.push(value);
    },
    end() {
      ended = true;
      let waiter: ((r: IteratorResult<T>) => void) | undefined;
      while ((waiter = waiters.shift())) waiter({ value: undefined as never, done: true });
    },
    iterable: {
      [Symbol.asyncIterator](): AsyncIterator<T> {
        return {
          next() {
            if (values.length > 0) return Promise.resolve({ value: values.shift()!, done: false });
            if (ended) return Promise.resolve({ value: undefined as never, done: true });
            return new Promise((resolve) => waiters.push(resolve));
          },
        };
      },
    } as AsyncIterable<T>,
  };
}
