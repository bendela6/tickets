// Per-model context windows (tokens). Configurable; unknown models fall back
// to the conservative 200k. Mirrors the models the Claude provider offers.
export const CONTEXT_WINDOW: Record<string, number> = {
  'claude-opus-4-8': 1_000_000,
  'claude-sonnet-5': 200_000,
  'claude-haiku-4-5-20251001': 200_000,
};

export function contextWindowFor(model?: string | null): number {
  return (model && CONTEXT_WINDOW[model]) || 200_000;
}

// Compact token count for meters: 0 · 948 · 72k · 1.2M.
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
