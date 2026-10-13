// The footer: two choices expanded, one flipping icon at rail width, the choice
// remembered under the key the app passed, and a pick of the theme already
// painted leaving a system preference alone.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '@bh/ui';
import { applyTheme } from './apply-theme';
import { ThemeFooter } from './theme-footer';

const KEY = 'test-theme';

function renderFooter(collapsed: boolean) {
  return render(
    <TooltipProvider>
      <ThemeFooter collapsed={collapsed} storageKey={KEY} />
    </TooltipProvider>,
  );
}

describe('ThemeFooter', () => {
  it('offers light and dark, not system, and remembers the pick under the app key', async () => {
    applyTheme('light', KEY);
    renderFooter(false);
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'Light',
      'Dark',
    ]);

    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(KEY)).toBe('dark');
  });

  it('leaves a system preference alone when the painted theme is picked', async () => {
    applyTheme('system', KEY);
    renderFooter(false);

    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));

    expect(document.documentElement.dataset.themePreference).toBe('system');
  });

  it('is one button at rail width that flips to the other theme', async () => {
    applyTheme('dark', KEY);
    renderFooter(true);
    expect(screen.queryByRole('radio')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Switch to the light theme' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(
      await screen.findByRole('button', { name: 'Switch to the dark theme' }),
    ).toBeInTheDocument();
  });
});
