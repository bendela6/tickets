// Filled in by Task 6. Declared here so the registry's type import resolves.
export interface AutomationContext {
  dispatch<TResult>(command: unknown, input: unknown, key?: string): Promise<TResult>;
}
