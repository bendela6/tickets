import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '../../api/types';
import { deriveUsage } from './derive-usage';

describe('deriveUsage', () => {
  it('returns nulls/zeroes with no result events', () => {
    expect(deriveUsage([{ type: 'assistant_text', text: 'hi' } as AgentEvent])).toEqual({
      contextTokens: null,
      tokensOut: 0,
      cacheReadTokens: 0,
    });
  });

  it('takes the last input tokens as context and sums output tokens', () => {
    const events: AgentEvent[] = [
      {
        type: 'result',
        costUsd: 0.1,
        durationMs: 1,
        isError: false,
        usage: { inputTokens: 40000, outputTokens: 1000, cacheReadTokens: 30000, cacheCreationTokens: 0 },
      },
      {
        type: 'result',
        costUsd: 0.2,
        durationMs: 1,
        isError: false,
        usage: { inputTokens: 72000, outputTokens: 1500, cacheReadTokens: 60000, cacheCreationTokens: 0 },
      },
    ];
    expect(deriveUsage(events)).toEqual({ contextTokens: 72000, tokensOut: 2500, cacheReadTokens: 90000 });
  });

  it('ignores result events with no usage', () => {
    const events: AgentEvent[] = [{ type: 'result', costUsd: 0, durationMs: 0, isError: false }];
    expect(deriveUsage(events)).toEqual({ contextTokens: null, tokensOut: 0, cacheReadTokens: 0 });
  });
});
