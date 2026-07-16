import type { AgentEvent } from '../../api/types';

// Fold the run's result events into the meter inputs. Context = the LAST turn's
// input tokens (the full context that was sent). Tokens-out = cumulative output
// across turns (input can't be summed — it re-sends context each turn).
export function deriveUsage(events: AgentEvent[]): {
  contextTokens: number | null;
  tokensOut: number;
  cacheReadTokens: number;
} {
  let contextTokens: number | null = null;
  let tokensOut = 0;
  let cacheReadTokens = 0;
  for (const event of events) {
    if (event.type === 'result' && event.usage) {
      contextTokens = event.usage.inputTokens;
      tokensOut += event.usage.outputTokens;
      cacheReadTokens += event.usage.cacheReadTokens;
    }
  }
  return { contextTokens, tokensOut, cacheReadTokens };
}
