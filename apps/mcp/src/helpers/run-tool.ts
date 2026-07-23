import { captureError, captureEvent } from '@bendela6/signals-node';

// Uniform error surface: tool failures come back as isError text results
// instead of protocol-level exceptions, so agents can read and react.
// Every failure is also reported to Signals with the tool name attached so
// the MCP tool surface isn't invisible to error monitoring — captureError
// no-ops safely if called before initMcpSignals() has resolved.
//
// Every call (success or failure) also emits an `mcp.tool` audit event with
// timing, so the tool surface is visible even when nothing goes wrong.
// captureEvent is best-effort, fire-and-forget — it never alters the
// resolved value or timing semantics of `work()`, and never throws.
export async function runTool(
  name: string,
  work: () => Promise<{ content: { type: 'text'; text: string }[] }>,
) {
  const startedAt = Date.now();
  try {
    const result = await work();
    captureEvent('mcp.tool', { name, ok: true, durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    captureEvent('mcp.tool', { name, ok: false, durationMs: Date.now() - startedAt });
    captureError(error, { level: 'error', mechanism: 'manual', contexts: { mcpTool: { name } } });
    return {
      content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}
