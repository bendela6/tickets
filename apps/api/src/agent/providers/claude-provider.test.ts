import { describe, expect, it } from 'vitest';
import type { SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { AgentEvent } from '../types';
import { createClaudeProvider, type QueryFn } from './claude-provider';

// A fake query() that captures the streamed input and lets the test push SDK
// messages out on demand — proves the adapter end to end without an API key or a
// spawned subprocess.
function makeFakeQuery() {
  const outbound: SDKMessage[] = [];
  let notify: (() => void) | null = null;
  let ended = false;
  const wake = () => {
    const n = notify;
    notify = null;
    n?.();
  };

  let capturedPrompt: AsyncIterable<SDKUserMessage> | null = null;
  let capturedCanUseTool: ((name: string, input: Record<string, unknown>) => Promise<unknown>) | null =
    null;
  let interrupted = false;

  const query: QueryFn = ((params: { prompt: unknown; options?: { canUseTool?: unknown } }) => {
    capturedPrompt = params.prompt as AsyncIterable<SDKUserMessage>;
    capturedCanUseTool = (params.options?.canUseTool ?? null) as typeof capturedCanUseTool;
    const gen = (async function* () {
      let i = 0;
      for (;;) {
        if (i < outbound.length) {
          yield outbound[i++]!;
          continue;
        }
        if (ended) return;
        await new Promise<void>((r) => (notify = r));
      }
    })();
    return Object.assign(gen, {
      interrupt: async () => {
        interrupted = true;
        ended = true;
        wake();
      },
    });
  }) as unknown as QueryFn;

  return {
    query,
    emit: (m: SDKMessage) => {
      outbound.push(m);
      wake();
    },
    finish: () => {
      ended = true;
      wake();
    },
    prompt: () => capturedPrompt,
    callCanUseTool: (name: string, input: Record<string, unknown>) => capturedCanUseTool!(name, input),
    wasInterrupted: () => interrupted,
  };
}

const asSdk = (m: unknown) => m as SDKMessage;

async function collect(events: AsyncIterable<AgentEvent>, until: (e: AgentEvent[]) => boolean) {
  const out: AgentEvent[] = [];
  for await (const e of events) {
    out.push(e);
    if (until(out)) break;
  }
  return out;
}

describe('claude provider', () => {
  it('exposes claude with capabilities and models', () => {
    const provider = createClaudeProvider({ query: makeFakeQuery().query });
    expect(provider.key).toBe('claude');
    expect(provider.capabilities).toEqual({
      permissions: true,
      resume: true,
      mcp: true,
      subagents: true,
    });
    expect(provider.models().some((m) => m.id === 'claude-opus-4-8')).toBe(true);
  });

  it('normalizes the SDK stream into AgentEvents and ends cleanly', async () => {
    const fake = makeFakeQuery();
    const run = createClaudeProvider({ query: fake.query }).start({
      cwd: '/w',
      model: 'claude-opus-4-8',
      permissionMode: 'bypassPermissions',
    });

    fake.emit(asSdk({ type: 'system', subtype: 'init', session_id: 'sess_1' }));
    fake.emit(
      asSdk({
        type: 'assistant',
        parent_tool_use_id: null,
        message: { content: [{ type: 'text', text: 'hello' }] },
      }),
    );
    fake.emit(
      asSdk({ type: 'result', subtype: 'success', total_cost_usd: 0.1, duration_ms: 5, is_error: false }),
    );
    fake.finish();

    const events = await collect(run.events, () => false);
    expect(events).toEqual([
      { type: 'session_started', providerSessionId: 'sess_1' },
      { type: 'assistant_text', text: 'hello', parentToolUseId: undefined },
      { type: 'result', costUsd: 0.1, durationMs: 5, isError: false, subtype: 'success' },
    ]);
  });

  it('send() feeds a user message into the SDK prompt stream', async () => {
    const fake = makeFakeQuery();
    const run = createClaudeProvider({ query: fake.query }).start({
      cwd: '/w',
      model: 'claude-opus-4-8',
      permissionMode: 'bypassPermissions',
    });
    await run.send('do the thing');
    const first = await fake.prompt()![Symbol.asyncIterator]().next();
    expect(first.value).toMatchObject({ type: 'user', message: { role: 'user', content: 'do the thing' } });
    run.close();
  });

  it('emits permission_request via canUseTool and respondToPermission resolves it (allow echoes input)', async () => {
    const fake = makeFakeQuery();
    const run = createClaudeProvider({ query: fake.query }).start({
      cwd: '/w',
      model: 'claude-opus-4-8',
      permissionMode: 'default',
    });

    // Invoke canUseTool the way the SDK would when the model requests a tool.
    const decision = fake.callCanUseTool('Bash', { command: 'ls' });

    // The provider surfaces it as a permission_request event carrying an id.
    const [request] = await collect(run.events, (e) => e.some((x) => x.type === 'permission_request'));
    expect(request).toMatchObject({ type: 'permission_request', toolName: 'Bash' });
    const id = (request as Extract<AgentEvent, { type: 'permission_request' }>).id;

    // Approving it resolves the parked canUseTool promise, echoing the input back.
    await run.respondToPermission(id, 'allow');
    await expect(decision).resolves.toEqual({ behavior: 'allow', updatedInput: { command: 'ls' } });

    // An unknown id is a harmless no-op.
    await expect(run.respondToPermission('nope', 'deny')).resolves.toBeUndefined();
    run.close();
  });

  it('interrupt() calls through to the SDK query', async () => {
    const fake = makeFakeQuery();
    const run = createClaudeProvider({ query: fake.query }).start({
      cwd: '/w',
      model: 'claude-opus-4-8',
      permissionMode: 'bypassPermissions',
    });
    await run.interrupt();
    expect(fake.wasInterrupted()).toBe(true);
  });
});
