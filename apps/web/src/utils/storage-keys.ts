export const STORAGE_KEYS = {
  // The light/dark choice: bh's applyTheme, useTheme and ThemeFooter all take it.
  theme: 'tickets-theme',
  // @tilewise/shell's sidebar keeps its collapsed flag, width and open sections under it.
  nav: 'tickets-nav',
  userId: 'tickets-user-id',
  lastProject: 'tickets-last-project',
  globalViews: 'tickets-global-views',
} as const;
