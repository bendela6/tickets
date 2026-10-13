// The sidebar's footer when the theme is all it holds: the light/dark choice.
// gateway, cv and the docs site each carried a copy; this is the one.

import { Moon, Sun } from 'lucide-react';
import { cn, Tooltip } from '@bh/ui';
import { NAV_STYLES } from '../nav';
import { ThemeChoice } from './theme-choice';
import type { ThemePreference } from './theme-types';
import { useTheme } from './use-theme';

/** Props for ThemeFooter component. */
export interface ThemeFooterProps {
  /** Whether the sidebar is at rail width — what AppShell's `footer` is told. */
  collapsed: boolean;
  /** Where the choice is remembered: the app's own key, e.g. `myapp-theme`. */
  storageKey: string;
}

/**
 * Expanded, both choices side by side; at rail width, one icon that flips to
 * the other. Its tooltip needs a `TooltipProvider` above the shell.
 *
 * Two choices, not three: an unset choice already follows the OS, so `System`
 * would name what happens anyway. Picking the theme already painted changes
 * nothing, so it does not pin a theme that was following the OS.
 */
export function ThemeFooter({ collapsed, storageKey }: ThemeFooterProps) {
  const { theme, setPreference } = useTheme(storageKey);
  const pick = (next: ThemePreference) => {
    if (next !== theme) {
      setPreference(next);
    }
  };

  if (collapsed) {
    const other = theme === 'dark' ? 'light' : 'dark';
    const label = `Switch to the ${other} theme`;
    const Icon = theme === 'dark' ? Moon : Sun;
    return (
      <div className="border-gray-6 shrink-0 border-t-1 px-8 py-6">
        <Tooltip content={label} side="right">
          <button
            type="button"
            aria-label={label}
            onClick={() => pick(other)}
            className={cn(
              'rounded-4 flex w-full items-center justify-center py-8',
              NAV_STYLES.focusRing,
              NAV_STYLES.control,
            )}
          >
            <Icon size={18} strokeWidth={1.75} />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="border-gray-6 shrink-0 border-t-1 px-12 py-10">
      <ThemeChoice preference={theme} offer={['light', 'dark']} onChange={pick} />
    </div>
  );
}
