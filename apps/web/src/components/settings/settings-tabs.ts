/** A settings tab, each a route of its own under /p/$projectKey/settings. */
export type SettingsTab = 'types' | 'fields' | 'workflow' | 'links' | 'repository';

/**
 * The settings tabs in the order they are listed. The first four edit the
 * project's scheme, which other projects may share; Repository is the
 * project's own.
 */
export const SETTINGS_TABS: readonly { tab: SettingsTab; label: string }[] = [
  { tab: 'types', label: 'Types' },
  { tab: 'fields', label: 'Fields' },
  { tab: 'workflow', label: 'Workflow' },
  { tab: 'links', label: 'Links' },
  { tab: 'repository', label: 'Repository' },
];
