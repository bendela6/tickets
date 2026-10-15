import { useMemo } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Database, FolderKanban, House, Plus, Rows3, Settings } from 'lucide-react';
import type { NavItem, NavSection } from '@bh/shell';
import { readStored } from '@bh/hooks';
import { useProjectStats } from '../../api/use-project-stats';
import { useProjects } from '../../api/use-projects';
import type { Project } from '../../api/types';
import { STORAGE_KEYS } from '../../utils/storage-keys';
import { SETTINGS_TABS } from '../settings/settings-tabs';

const NO_PROJECTS: Project[] = [];

/** What the sidebar's own buttons do, which the frame that holds it decides. */
export interface NavActions {
  /** The "+" on the Projects section: opens the new project dialog. */
  onNewProject: () => void;
}

/**
 * Whose settings the sidebar's Settings opens: the project on screen, else
 * the one last opened, else the first; none while there is no project.
 */
function settingsProjectKey(projects: Project[], onScreen: string | undefined) {
  const last = readStored(STORAGE_KEYS.lastProject);
  const known = (key: string | null | undefined) => {
    return projects.some((project) => project.key === key) ? key : undefined;
  };
  return known(onScreen) ?? known(last) ?? projects[0]?.key;
}

/** Settings, with each of its tabs (routes/settings-route.tsx) a page under it. */
function settingsItem(projectKey: string): NavItem {
  const path = `/p/${projectKey}/settings`;
  return {
    label: 'Settings',
    path,
    icon: Settings,
    children: SETTINGS_TABS.map(({ tab, label }) => ({ label, path: `${path}/${tab}` })),
  };
}

/**
 * The sidebar, in the order it is drawn. Each destination is a route in
 * ../../router.ts. Home counts the projects it lists, and All items the
 * items across them; Projects lists every project with its own count, and
 * carries "New project"; System holds the database's Schema and a project's
 * Settings, its tabs under it. An item count is of top-level items, as the
 * page it opens counts them, and shows once every board it sums has loaded,
 * rather than a low one first.
 */
export function useNav({ onNewProject }: NavActions): readonly NavSection[] {
  const projectsQuery = useProjects();
  const projects = projectsQuery.data?.data ?? NO_PROJECTS;
  const stats = useProjectStats(projects);
  // From the address, as the sidebar lights its rows: every page of a
  // project, its views, items and settings, is under /p/<key>.
  const onScreen = useRouterState({
    select: (state) => /^\/p\/([^/]+)/.exec(state.location.pathname)?.[1],
  });
  const settingsKey = settingsProjectKey(projects, onScreen);
  const projectCount = projectsQuery.data ? projects.length : undefined;
  const itemCount =
    projectsQuery.data && stats.every((query) => query.data !== undefined)
      ? stats.reduce((sum, query) => sum + (query.data?.items ?? 0), 0)
      : undefined;
  // One key for the counts, so the list is rebuilt when one changes and not
  // on every render (useQueries hands back a new array each time).
  const countsKey = stats.map((query) => query.data?.items ?? '').join(',');
  const projectItems = useMemo(() => {
    const counts = countsKey.split(',');
    return projects.map((project, index) => {
      return {
        label: project.name,
        path: `/p/${project.key}`,
        icon: FolderKanban,
        count: counts[index] ? Number(counts[index]) : undefined,
      };
    });
  }, [projects, countsKey]);
  return useMemo(() => {
    return [
      {
        id: 'main',
        items: [
          { label: 'Home', path: '/', icon: House, count: projectCount },
          { label: 'All items', path: '/all', icon: Rows3, count: itemCount },
        ],
      },
      {
        id: 'projects',
        label: 'Projects',
        action: { label: 'New project', icon: Plus, onSelect: onNewProject },
        items: projectItems,
      },
      {
        id: 'system',
        label: 'System',
        items: [
          { label: 'Schema', path: '/schema', icon: Database },
          ...(settingsKey ? [settingsItem(settingsKey)] : []),
        ],
      },
    ];
  }, [projectCount, itemCount, projectItems, onNewProject, settingsKey]);
}
