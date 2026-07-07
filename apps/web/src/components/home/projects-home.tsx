import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { ProjectStats } from '../../api/use-project-stats';
import { useProjects } from '../../api/use-projects';
import { useProjectStats } from '../../api/use-project-stats';
import { Button } from '../../ui/button';
import { KindGlyph } from '../../ui/kind-glyph';
import { relativeLabel } from '../../ui/relative-date';
import { NewProjectDialog } from '../shell/new-project-dialog';

const BAR_MAX_PX = 18;
const BAR_MIN_PX = 3;

function ProjectCard({ stats }: { stats: ProjectStats }) {
  const { project, counts, total, pct, activity, lastUpdatedAt } = stats;
  const peak = Math.max(1, ...activity);
  const events = activity.reduce((sum, count) => sum + count, 0);
  return (
    <Link
      to="/p/$projectKey"
      params={{ projectKey: project.key }}
      className="flex cursor-pointer flex-col gap-3.25 rounded-panel border border-hairline bg-raised px-5 py-4.5 shadow-sm hover:border-control"
    >
      <div className="flex items-center gap-2.5">
        <span className="rounded-[5px] bg-inset px-1.75 py-0.75 font-mono text-meta font-medium text-ink">
          {project.ticketPrefix}
        </span>
        <span className="flex-1 truncate font-sans text-[15px] font-semibold text-ink">
          {project.name}
        </span>
        <span className="font-mono text-[11px] text-ink-3">{project.key}</span>
      </div>

      <div className="flex flex-col gap-1.75">
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          {counts.done > 0 ? <span className="bg-kind-done" style={{ flex: counts.done }} /> : null}
          {counts.active > 0 ? (
            <span className="bg-kind-active" style={{ flex: counts.active }} />
          ) : null}
          {counts.blocked > 0 ? (
            <span className="bg-kind-blocked" style={{ flex: counts.blocked }} />
          ) : null}
          {counts.todo > 0 ? <span className="bg-control" style={{ flex: counts.todo }} /> : null}
          {total === 0 ? <span className="flex-1 bg-hairline" /> : null}
        </div>
        <div className="flex items-center gap-3.5 font-sans text-meta text-ink-2">
          <span className="font-mono text-ui font-semibold text-ink">{pct}%</span>
          <span className="inline-flex items-center gap-1.25 text-kind-todo">
            <KindGlyph kind="todo" />
            <span className="text-ink-2">{counts.todo}</span>
          </span>
          <span className="inline-flex items-center gap-1.25 text-kind-active">
            <KindGlyph kind="active" />
            <span className="text-ink-2">{counts.active}</span>
          </span>
          <span className="inline-flex items-center gap-1.25 text-kind-blocked">
            <KindGlyph kind="blocked" />
            <span className="text-ink-2">{counts.blocked}</span>
          </span>
          <span className="inline-flex items-center gap-1.25 text-kind-done">
            <KindGlyph kind="done" />
            <span className="text-ink-2">{counts.done}</span>
          </span>
          <span className="flex-1" />
          <span className="font-mono text-[11px] text-ink-3">{total} total</span>
        </div>
      </div>

      <div className="flex items-end gap-3 border-t border-hairline pt-3">
        <span className="inline-flex h-4.5 items-end gap-0.5">
          {activity.map((count, index) => (
            <span
              key={index}
              className="w-1.25 rounded-t-[2px] bg-control"
              style={{
                height: `${BAR_MIN_PX + Math.round((count / peak) * (BAR_MAX_PX - BAR_MIN_PX))}px`,
              }}
            />
          ))}
        </span>
        <span className="font-mono text-[11px] text-ink-3">{events} events · 14d</span>
        <span className="flex-1" />
        <span className="font-sans text-[11px] text-ink-3">
          {lastUpdatedAt ? `last: ${relativeLabel(lastUpdatedAt, new Date())}` : 'no activity yet'}
        </span>
      </div>
    </Link>
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
    <div className="px-4 py-5 md:px-8 md:py-7">
      <div className="mb-5.5 flex items-baseline gap-3.5">
        <h1 className="font-sans text-[22px] font-semibold text-ink">Projects</h1>
        <span className="font-mono text-meta text-ink-3">
          {projectList.length} projects · {totalTickets} tickets · {openTickets} open
        </span>
        <span className="flex-1" />
        <Button variant="secondary" size="compact" onClick={() => setCreating(true)}>
          ＋ New project
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {projectList.map((project) => {
          const stat = loaded.find((entry) => entry.project.key === project.key);
          return stat ? (
            <ProjectCard key={project.id} stats={stat} />
          ) : (
            <div
              key={project.id}
              className="min-h-37.5 animate-pulse rounded-panel border border-hairline bg-raised"
            />
          );
        })}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex min-h-37.5 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-panel border border-dashed border-control text-ink-3 hover:border-ink-3 hover:text-ink-2"
        >
          <span className="font-sans text-[20px]">＋</span>
          <span className="font-sans text-ui font-medium">New project</span>
          <span className="font-mono text-[11px]">key · name · prefix</span>
        </button>
      </div>

      <NewProjectDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
