import { collectDemos } from './collect-demos';

// The package's own demos. import.meta.glob is executed by the CONSUMER's
// vite (web or the dev app), relative to this file.
export const packageDemos = collectDemos(
  import.meta.glob('../**/*.demo.tsx', { eager: true }) as Record<string, unknown>,
);
