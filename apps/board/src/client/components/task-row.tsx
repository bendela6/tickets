import { Pill, Prose, type Tone } from '@tickets/ui';
import type { Feature, Task, TaskStatus } from '../../shared/types';
import { duration } from '../api';

// Shared by the Tasks list and the drawer a Feature opens, so a task looks the same
// wherever it is read.

export const STATUS_TONE: Record<TaskStatus, Tone> = {
  'in progress': 'primary',
  blocked: 'warning',
  done: 'success',
  cancelled: 'neutral',
  todo: 'neutral',
};

/** Unfinished work first — a completed list is history, not the answer to "what now". */
export const STATUS_ORDER: TaskStatus[] = ['in progress', 'blocked', 'todo', 'done', 'cancelled'];

export function byStatus(a: Task, b: Task): number {
  return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
}

export interface Rollup {
  total: number;
  done: number;
  open: number;
  blocked: number;
  active: number;
  estimated: number;
  spent: number;
  percent: number;
}

export function rollup(features: Feature[]): Rollup {
  const tasks = features.flatMap((f) => f.tasks);
  const done = tasks.filter((t) => t.status === 'done').length;
  // Cancelled work is neither done nor outstanding, so it counts toward neither.
  const counted = tasks.filter((t) => t.status !== 'cancelled').length;
  return {
    total: tasks.length,
    done,
    open: tasks.filter((t) => t.status === 'todo' || t.status === 'in progress').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
    active: tasks.filter((t) => t.status === 'in progress').length,
    estimated: tasks.reduce((n, t) => n + (t.estimated ?? 0), 0),
    spent: tasks.reduce((n, t) => n + (t.spent ?? 0), 0),
    percent: counted ? (done / counted) * 100 : 0,
  };
}

export function TaskRow({ task }: { task: Task }) {
  // Over budget is a normal state, not an error — the bar clamps and the figure
  // carries the overrun, so both numbers stay meaningful.
  const over = task.estimated != null && task.spent != null && task.spent > task.estimated;
  const finished = task.status === 'done' || task.status === 'cancelled';

  return (
    <li
      className={[
        'min-w-0 rounded-6 border border-gray-6 bg-surface-raised px-12 py-8',
        finished ? 'opacity-60' : '',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-start gap-8">
        <Pill label={task.status} tone={STATUS_TONE[task.status]} size="sm" />
        <span
          className={[
            'min-w-0 flex-1 text-13/19 text-gray-12',
            task.status === 'cancelled' ? 'line-through' : '',
          ].join(' ')}
        >
          {task.title}
        </span>
        {task.spent != null || task.estimated != null ? (
          <span
            className={[
              'shrink-0 font-mono text-11 tabular-nums',
              over ? 'text-orange-11' : 'text-gray-11',
            ].join(' ')}
          >
            {duration(task.spent ?? 0)}
            {task.estimated != null ? ` / ${duration(task.estimated)}` : ''}
          </span>
        ) : null}
      </div>

      {task.description ? <Prose className="mt-4 pl-4">{task.description}</Prose> : null}

      {task.blockedBy ? (
        <p className="mt-6 text-12/17 text-orange-11">Blocked by: {task.blockedBy}</p>
      ) : null}
    </li>
  );
}
