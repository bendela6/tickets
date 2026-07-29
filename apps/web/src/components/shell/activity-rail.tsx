import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { applyTheme } from '../../utils/apply-theme';
import { cn } from '@tickets/ui';
import { ActorMenu } from './actor-menu';
import type { Mode } from './mode-for-path';

const ITEMS: { mode: Mode; to: '/' | '/terminals' | '/agents' | '/signals'; glyph: string; label: string }[] = [
  { mode: 'tasks', to: '/', glyph: '▦', label: 'Tasks' },
  { mode: 'terminals', to: '/terminals', glyph: '▷_', label: 'Terminals' },
  { mode: 'agents', to: '/agents', glyph: '✳', label: 'Agents' },
  { mode: 'signals', to: '/signals', glyph: '∿', label: 'Signals' },
];

// The always-visible mode switcher. Active mode is passed in (derived from the
// route), so deep links light the right icon.
export function ActivityRail({ mode, onNavigate }: { mode: Mode | null; onNavigate?: () => void }) {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme ?? 'light');
  return (
    <aside className="flex w-12 flex-none flex-col items-center gap-1.5 border-r-1 border-gray-6 bg-gray-1 py-3">
      <Link to="/" onClick={onNavigate} className="mb-2" aria-label="tickets home">
        <span aria-hidden className="block size-2.5 rounded-sm bg-indigo-9" />
      </Link>
      {ITEMS.map((item) => (
        <Link
          key={item.mode}
          to={item.to}
          onClick={onNavigate}
          aria-label={item.label}
          title={item.label}
          className={cn(
            'flex size-9 items-center justify-center rounded-lg font-mono text-13',
            mode === item.mode
              ? 'bg-indigo-9 text-indigo-contrast'
              : 'text-gray-11 hover:bg-surface-inset hover:text-gray-12',
          )}
        >
          {item.glyph}
        </Link>
      ))}
      <span className="flex-1" />
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={() => {
          const next = theme === 'dark' ? 'light' : 'dark';
          applyTheme(next);
          setTheme(next);
        }}
        className="flex size-9 items-center justify-center rounded-lg text-gray-11 hover:bg-surface-inset"
      >
        ◐
      </button>
      <ActorMenu compact />
    </aside>
  );
}
