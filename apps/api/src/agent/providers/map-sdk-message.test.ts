import { describe, expect, it } from 'vitest';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { mapSdkMessage } from './map-sdk-message';

// Fabricated SDK messages — only the fields the mapper reads; cast through
// unknown so the test isn't coupled to the SDK's full (huge) message shape.
const asSdk = (m: unknown) => m as SDKMessage;

describe('mapSdkMessage', () => {
  it('maps the init system message to session_started', () => {
    expect(mapSdkMessage(asSdk({ type: 'system', subtype: 'init', session_id: 'sess_1' }))).toEqual([
      { type: 'session_started', providerSessionId: 'sess_1' },
    ]);
  });

  it('ignores non-init system messages', () => {
    expect(mapSdkMessage(asSdk({ type: 'system', subtype: 'status', status: null }))).toEqual([]);
  });

  it('splits an assistant message into text, thinking, and tool_use events', () => {
    const events = mapSdkMessage(
      asSdk({
        type: 'assistant',
        parent_tool_use_id: null,
        message: {
          content: [
            { type: 'thinking', thinking: 'hmm' },
            { type: 'text', text: 'Here goes' },
            { type: 'tool_use', id: 'tu_1', name: 'Read', input: { file: 'a.ts' } },
          ],
        },
      }),
    );
    expect(events).toEqual([
      { type: 'thinking', text: 'hmm' },
      { type: 'assistant_text', text: 'Here goes', parentToolUseId: undefined },
      { type: 'tool_use', id: 'tu_1', name: 'Read', input: { file: 'a.ts' }, parentToolUseId: undefined },
    ]);
  });

  it('carries parent_tool_use_id onto subagent assistant output', () => {
    const [event] = mapSdkMessage(
      asSdk({
        type: 'assistant',
        parent_tool_use_id: 'tu_parent',
        message: { content: [{ type: 'text', text: 'sub' }] },
      }),
    );
    expect(event).toEqual({ type: 'assistant_text', text: 'sub', parentToolUseId: 'tu_parent' });
  });

  it('maps a tool_result user message, defaulting isError to false', () => {
    const events = mapSdkMessage(
      asSdk({
        type: 'user',
        parent_tool_use_id: null,
        message: {
          content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'ok' }],
        },
      }),
    );
    expect(events).toEqual([
      { type: 'tool_result', toolUseId: 'tu_1', content: 'ok', isError: false },
    ]);
  });

  it('ignores a bare-string user message (our own prompt echo)', () => {
    expect(
      mapSdkMessage(asSdk({ type: 'user', parent_tool_use_id: null, message: { content: 'hi' } })),
    ).toEqual([]);
  });

  it('maps the result message to cost + duration + error flag', () => {
    expect(
      mapSdkMessage(
        asSdk({
          type: 'result',
          subtype: 'success',
          total_cost_usd: 0.42,
          duration_ms: 1234,
          is_error: false,
        }),
      ),
    ).toEqual([{ type: 'result', costUsd: 0.42, durationMs: 1234, isError: false, subtype: 'success' }]);
  });

  it('maps result usage into the result event', () => {
    const events = mapSdkMessage({
      type: 'result',
      subtype: 'success',
      total_cost_usd: 0.12,
      duration_ms: 3400,
      is_error: false,
      usage: {
        input_tokens: 72000,
        output_tokens: 1500,
        cache_read_input_tokens: 60000,
        cache_creation_input_tokens: 200,
      },
    } as never);
    expect(events).toEqual([
      {
        type: 'result',
        costUsd: 0.12,
        durationMs: 3400,
        isError: false,
        subtype: 'success',
        usage: {
          inputTokens: 72000,
          outputTokens: 1500,
          cacheReadTokens: 60000,
          cacheCreationTokens: 200,
        },
      },
    ]);
  });

  it('omits usage when the result carries none', () => {
    const events = mapSdkMessage({
      type: 'result',
      subtype: 'success',
      total_cost_usd: 0.01,
      duration_ms: 10,
      is_error: false,
    } as never);
    expect(events[0]).not.toHaveProperty('usage');
  });

  it('defaults missing usage token fields to 0', () => {
    const events = mapSdkMessage({
      type: 'result',
      subtype: 'success',
      total_cost_usd: 0,
      duration_ms: 0,
      is_error: false,
      usage: { output_tokens: 42 },
    } as never);
    expect(events[0]).toMatchObject({
      usage: { inputTokens: 0, outputTokens: 42, cacheReadTokens: 0, cacheCreationTokens: 0 },
    });
  });
});
