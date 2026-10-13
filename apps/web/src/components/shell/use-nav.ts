import { useMemo } from 'react';
import { Database, FolderKanban, House, Plus, Rows3 } from 'lucide-react';
import type { NavSection } from '@bh/shell';
import { useProjectStats } from '../../api/use-project-stats';
import { useProjects } from '../../api/use-projects';
import type { Project } from '../../api/types';

const NO_PROJECTS: Project[] = [];

/** What the sidebar's own buttons do, which the frame that holds it decides. */
export interface NavActions {
  /** The "+" on the Projects section: opens the new project dialog. */
  onNewProject: () => void;
}

/**
 * The sidebar, in the order it is drawn. Each destination is a route in
 * ../../router.ts. Home counts the projects it lists, and All items the
 * items across them; Projects lists every project with its own count, and
 * carries "New project"; System holds the database's Schema. A count shows
 * once every board it sums has loaded, rather than a low one first.
 */
export function useNav({ onNewProject }: NavActions): readonly NavSection[] {
  const projectsQuery = useProjects();
  const projects = projectsQuery.data?.data ?? NO_PROJECTS;
  const stats = useProjectStats(projects);
  const projectCount = projectsQuery.data ? projects.length : undefined;
  const itemCount =
    projectsQuery.data && stats.every((query) => query.data !== undefined)
      ? stats.reduce((sum, query) => sum + (query.data?.total ?? 0), 0)
      : undefined;
  // One key for the counts, so the list is rebuilt when one changes and not
  // on every render (useQueries hands back a new array each time).
  const countsKey = stats.map((query) => query.data?.total ?? '').join(',');
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
        items: [{ label: 'Schema', path: '/schema', icon: Database }],
      },
    ];
  }, [projectCount, itemCount, projectItems, onNewProject]);
}
