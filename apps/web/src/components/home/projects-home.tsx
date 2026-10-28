import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { ProjectStats } from '../../api/use-project-stats';
import { useProjects } from '../../api/use-projects';
import { useProjectStats } from '../../api/use-project-stats';
import { KIND_ICON, KIND_TONE } from '../../domain/status';
import { Page, PageBody, PageHeader } from '@tilewise/shell/layout';
import { Button, Card, Icon, relativeLabel } from '@tilewise/ui';
import { NewProjectDialog } from '../shell/new-project-dialog';

const BAR_MAX_PX = 18;
const BAR_MIN_PX = 3;

function ProjectCard({ stats }: { stats: ProjectStats }) {
  const { project, counts, total, pct, activity, lastUpdatedAt } = stats;
  const peak = Math.max(1, ...activity);
  const events = activity.reduce((sum, count) => sum + count, 0);
  return (
    // The card is the link itself: bh's Card draws its look and its focus
    // ring on the router's link.
    <Card asChild interactive padding={4} className="flex flex-col gap-13">
      <Link to="/p/$projectKey" params={{ projectKey: project.key }}>
        <div className="flex items-center gap-10">
          <span className="rounded-6 bg-surface-inset px-7 py-3 font-mono text-12/17 font-500 text-gray-12">
            {project.itemPrefix}
          </span>
          <span className="flex-1 truncate font-sans text-15 font-600 text-gray-12">
            {project.name}
          </span>
          <span className="font-mono text-11 text-gray-9">{project.key}</span>
        </div>

        <div className="flex flex-col gap-7">
          <div className="flex h-6 gap-2 overflow-hidden rounded-full">
            {counts.done > 0 ? <span className="bg-green-9" style={{ flex: counts.done }} /> : null}
            {counts.active > 0 ? (
              <span className="bg-blue-9" style={{ flex: counts.active }} />
            ) : null}
            {counts.blocked > 0 ? (
              <span className="bg-orange-9" style={{ flex: counts.blocked }} />
            ) : null}
            {counts.todo > 0 ? <span className="bg-gray-7" style={{ flex: counts.todo }} /> : null}
            {total === 0 ? <span className="flex-1 bg-gray-6" /> : null}
          </div>
          <div className="flex items-center gap-14 font-sans text-12/17 text-gray-11">
            <span className="font-mono text-13/19 font-600 text-gray-12">{pct}%</span>
            <span className="inline-flex items-center gap-5">
              <Icon name={KIND_ICON.todo} tone={KIND_TONE.todo} size="xs" />
              <span className="text-gray-11">{counts.todo}</span>
            </span>
            <span className="inline-flex items-center gap-5">
              <Icon name={KIND_ICON.active} tone={KIND_TONE.active} size="xs" />
              <span className="text-gray-11">{counts.active}</span>
            </span>
            <span className="inline-flex items-center gap-5">
              <Icon name={KIND_ICON.blocked} tone={KIND_TONE.blocked} size="xs" />
              <span className="text-gray-11">{counts.blocked}</span>
            </span>
            <span className="inline-flex items-center gap-5">
              <Icon name={KIND_ICON.done} tone={KIND_TONE.done} size="xs" />
              <span className="text-gray-11">{counts.done}</span>
            </span>
            <span className="flex-1" />
            <span className="font-mono text-11 text-gray-9">{total} total</span>
          </div>
        </div>

        <div className="flex items-end gap-12 border-t-1 border-gray-6 pt-12">
          <span className="inline-flex h-18 items-end gap-2">
            {activity.map((count, index) => (
              <span
                key={index}
                // rounded-t-full, not a scale rung: bars are 5px wide (w-5) and
                // as short as BAR_MIN_PX (3px) — a rounded-t-4 corner (4px) would
                // overflow both the width and the minimum height, so this stays
                // off the radius scale deliberately, matching sparkline.tsx.
                className="w-5 rounded-t-full bg-gray-7"
                style={{
                  height: `${BAR_MIN_PX + Math.round((count / peak) * (BAR_MAX_PX - BAR_MIN_PX))}px`,
                }}
              />
            ))}
          </span>
          <span className="font-mono text-11 text-gray-9">{events} events · 14d</span>
          <span className="flex-1" />
          <span className="font-sans text-11 text-gray-9">
            {lastUpdatedAt
              ? `last: ${relativeLabel(lastUpdatedAt, new Date())}`
              : 'no activity yet'}
          </span>
        </div>
      </Link>
    </Card>
  );
}

export function ProjectsHome() {
  const projects = useProjects();
  const projectList = projects.data?.data ?? [];
  const stats = useProjectStats(projectList);
  const loaded = stats.flatMap((query) => (query.data ? [query.data] : []));
  const totalTickets = loaded.reduce((sum, stat) => sum + stat.total, 0);
  const openTickets = loaded.reduce(
    (sum, stat) => sum + stat.counts.todo + stat.counts.active + stat.counts.blocked,
    0,
  );
  const [creating, setCreating] = useState(false);

  return (
    <Page
      header={
        <PageHeader
          title="Projects"
          description={
            <span className="font-mono text-12/17 text-gray-9">
              {projectList.length} projects · {totalTickets} items · {openTickets} open
            </span>
          }
          actions={
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              ＋ New project
            </Button>
          }
        />
      }
    >
      <PageBody>
        {/* Cards in a grid of their own rather than a CardGrid: a project card
          holds a row of counts that two columns squeeze below xl. */}
        <div className="grid grid-cols-1 gap-16 xl:grid-cols-2">
          {projectList.map((project) => {
            const stat = loaded.find((entry) => entry.project.key === project.key);
            return stat ? (
              <ProjectCard key={project.id} stats={stat} />
            ) : (
              <Card key={project.id} className="min-h-150 animate-pulse" />
            );
          })}
          {/* A card with nothing in it yet: dashed, on the page's own floor,
              its words in its middle. */}
          <Card
            asChild
            interactive
            className="flex min-h-150 flex-col items-center justify-center gap-6 border-dashed border-gray-7 bg-transparent text-center text-gray-9 hover:border-gray-9 hover:text-gray-11"
          >
            <button type="button" onClick={() => setCreating(true)}>
              <span className="font-sans text-20">＋</span>
              <span className="font-sans text-13/19 font-500">New project</span>
              <span className="font-mono text-11">key · name · prefix</span>
            </button>
          </Card>
        </div>
      </PageBody>

      <NewProjectDialog open={creating} onOpenChange={setCreating} />
    </Page>
  );
}
