// Uniform error surface: tool failures come back as isError text results
// instead of protocol-level exceptions, so agents can read and react.
export async function runTool(
  name: string,
  work: () => Promise<{ content: { type: 'text'; text: string }[] }>,
) {
  try {
    return await work();
  } catch (error) {
    console.error(`tickets mcp: ${name} failed`, error);
    return {
      content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}
