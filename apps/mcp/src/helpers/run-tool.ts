// Uniform error surface: tool failures come back as isError text results
// instead of protocol-level exceptions, so agents can read and react.
export async function runTool(work: () => Promise<{ content: { type: 'text'; text: string }[] }>) {
  try {
    return await work();
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}
