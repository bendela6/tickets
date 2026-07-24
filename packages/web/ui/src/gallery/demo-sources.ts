export const packageDemoSources = import.meta.glob('../**/*.demo.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
