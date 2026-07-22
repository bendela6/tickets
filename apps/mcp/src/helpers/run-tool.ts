import { captureError } from '@bendela6/signals-node';

// Uniform error surface: tool failures come back as isError text results
// instead of protocol-level exceptions, so agents can read and react.
// Every failure is also reported to Signals with the tool name attached so
// the MCP tool surface isn't invisible to error monitoring — captureError
// no-ops safely if called before initMcpSignals() has resolved.
export async function runTool(
  name: string,
  work: () => Promise<{ content: { type: 'text'; text: string }[] }>,
) {
  try {
    return await work();
  } catch (error) {
    captureError(error, { level: 'error', mechanism: 'manual', contexts: { mcpTool: { name } } });
    return {
      content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}
