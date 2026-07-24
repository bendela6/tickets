import { collectDemos, rebaseGlobKeys } from './collect-demos';
import { UI_SRC_ROOT } from './roots';

// The package's own demos. import.meta.glob is executed by the CONSUMER's
// vite (web or the dev app), relative to this file — then rebased onto the
// workspace-relative root so the keys stay unique when the web route merges
// them with the app's own demo map.
export const packageDemos = collectDemos(
  rebaseGlobKeys(
    UI_SRC_ROOT,
    import.meta.glob('../**/*.demo.tsx', { eager: true }) as Record<string, unknown>,
  ),
);
