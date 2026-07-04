import { STORAGE_KEYS } from './storage-keys';
import { writeLocal } from './write-local';

export function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
  writeLocal(STORAGE_KEYS.theme, theme);
}
