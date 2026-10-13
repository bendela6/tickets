import { useMemo } from 'react';
import { House, Rows3 } from 'lucide-react';
import type { NavSection } from '@bh/shell';
import { useProjectStats } from '../../api/use-project-stats';
import { useProjects } from '../../api/use-projects';
import type { Project } from '../../api/types';

const NO_PROJECTS: Project[] = [];

/**
 * The sidebar, in the order it is drawn. Each destination is a route in
 * ../../router.ts. Home counts the projects it lists, and All items the
 * items across them, once every project's board has loaded; until then they
 * show no count rather than a low one.
 */
export function useNav(): readonly NavSection[] {
  const projectsQuery = useProjects();
  const projects = projectsQuery.data?.data ?? NO_PROJECTS;
  const stats = useProjectStats(projects);
  const projectCount = projectsQuery.data ? projects.length : undefined;
  const itemCount =
    projectsQuery.data && stats.every((query) => query.data !== undefined)
      ? stats.reduce((sum, query) => sum + (query.data?.total ?? 0), 0)
      : undefined;
  return useMemo(() => {
    return [
      {
        id: 'main',
        items: [
          { label: 'Home', path: '/', icon: House, count: projectCount },
          { label: 'All items', path: '/all', icon: Rows3, count: itemCount },
        ],
      },
    ];
  }, [projectCount, itemCount]);
}
