// The theme: applyTheme stamps both halves and remembers under the app's key,
// readStoredTheme falls back to system, useTheme keeps every consumer in step,
// and ThemeChoice offers what the app asks for.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { applyTheme } from './apply-theme';
import { readStoredTheme } from './read-stored-theme';
import { ThemeChoice } from './theme-choice';
import { useTheme } from './use-theme';

const KEY = 'test-theme';

describe('applyTheme and readStoredTheme', () => {
  it('stamps the root and stores the choice under the given key', () => {
    applyTheme('dark', KEY);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('dark');
    expect(localStorage.getItem(KEY)).toBe('dark');
  });

  it('resolves system to a concrete theme but stores the preference', () => {
    applyTheme('system', KEY);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.themePreference).toBe('system');
    expect(localStorage.getItem(KEY)).toBe('system');
  });

  it('reads back what was stored, and system when nothing or nonsense was', () => {
    expect(readStoredTheme(KEY)).toBe('system');
    localStorage.setItem(KEY, 'dark');
    expect(readStoredTheme(KEY)).toBe('dark');
    localStorage.setItem(KEY, 'sepia');
    expect(readStoredTheme(KEY)).toBe('system');
  });
});

function ThemeReader({ label }: { label: string }) {
  const { theme, preference, setPreference } = useTheme(KEY);
  return (
    <button type="button" onClick={() => setPreference(theme === 'dark' ? 'light' : 'dark')}>
      {label}: {theme} via {preference}
    </button>
  );
}

describe('useTheme', () => {
  it('updates every consumer when one of them sets a new theme', async () => {
    applyTheme('light', KEY);
    render(
      <>
        <ThemeReader label="sidebar" />
        <ThemeReader label="settings" />
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'sidebar: light via light' }));

    expect(
      await screen.findByRole('button', { name: 'sidebar: dark via dark' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'settings: dark via dark' }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe('dark');
  });

  it('reports system separately from the theme it resolves to', () => {
    applyTheme('system', KEY);
    render(<ThemeReader label="sidebar" />);
    expect(screen.getByRole('button', { name: 'sidebar: light via system' })).toBeInTheDocument();
  });
});

describe('ThemeChoice', () => {
  it('offers all three by default', () => {
    render(<ThemeChoice preference="system" onChange={() => {}} />);
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'Light',
      'Dark',
      'System',
    ]);
  });

  it('offers only what the app asks for, and reports the pick', async () => {
    const picked: string[] = [];
    render(
      <ThemeChoice
        preference="light"
        offer={['light', 'dark']}
        onChange={(next) => picked.push(next)}
      />,
    );
    expect(screen.queryByRole('radio', { name: 'System' })).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(picked).toEqual(['dark']);
  });
});
