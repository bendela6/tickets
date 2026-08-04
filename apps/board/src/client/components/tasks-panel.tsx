import { Pill, ScreenState } from '@tickets/ui';
import type { Feature } from '../../shared/types';
import { byStatus, rollup, TaskRow } from './task-row';

// Every task in the session as one list, ordered by what still needs doing. The
// Features tab is where the same tasks are read grouped and in context; this one
// answers "what is outstanding, across everything".

export function TasksPanel({ features }: { features: Feature[] }) {
  const tasks = features.flatMap((f) => f.tasks);
  if (tasks.length === 0) {
    return <ScreenState title="No tasks tracked in this session" />;
  }

  const stats = rollup(features);
  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-wrap gap-6">
        <Pill label={`${stats.done} done`} tone="success" size="sm" />
        {stats.active ? <Pill label={`${stats.active} in progress`} tone="primary" size="sm" /> : null}
        {stats.blocked ? <Pill label={`${stats.blocked} blocked`} tone="warning" size="sm" /> : null}
        {stats.open - stats.active > 0 ? (
          <Pill label={`${stats.open - stats.active} todo`} tone="neutral" size="sm" />
        ) : null}
        {stats.total - stats.done - stats.open - stats.blocked > 0 ? (
          <Pill
            label={`${stats.total - stats.done - stats.open - stats.blocked} cancelled`}
            tone="neutral"
            size="sm"
          />
        ) : null}
      </div>

      <ul className="flex flex-col gap-6">
        {[...tasks].sort(byStatus).map((task, i) => (
          <TaskRow key={`${task.title}-${i}`} task={task} />
        ))}
      </ul>
    </div>
  );
}
