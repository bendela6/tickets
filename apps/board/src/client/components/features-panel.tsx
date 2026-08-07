import { Drawer, Pill, Progress, Prose, ScreenState } from '@tickets/ui';
import { useState } from 'react';
import type { Feature } from '../../shared/types';
import { duration } from '../api';
import { byStatus, rollup, TaskRow } from './task-row';

// The list stays deliberately thin — a title, its progress, and what is outstanding —
// so a session's shape is readable in one glance. A feature's description and its
// tasks are a level down, in a drawer, because they are reading material rather than
// something to scan.

export function FeaturesPanel({ features }: { features: Feature[] }) {
  const [openName, setOpenName] = useState<string | null>(null);

  if (features.length === 0) {
    return <ScreenState title="No features tracked in this session" />;
  }

  const open = features.find((f) => f.name === openName) ?? null;

  return (
    <>
      <ul className="flex flex-col gap-6">
        {features.map((feature) => (
          <FeatureRow key={feature.name} feature={feature} onOpen={() => setOpenName(feature.name)} />
        ))}
      </ul>

      <Drawer
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpenName(null);
        }}
        label={open?.name ?? 'Feature'}
        size="lg"
        storageKey="board:feature-drawer"
        maximizable
      >
        {open ? <FeatureDetail feature={open} /> : null}
      </Drawer>
    </>
  );
}

function FeatureRow({ feature, onOpen }: { feature: Feature; onOpen: () => void }) {
  const stats = rollup([feature]);
  const complete = stats.done === stats.total;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-6 border border-gray-6 bg-surface-raised px-14 py-12 text-left hover:border-gray-7"
      >
        <span className="mb-8 flex min-w-0 items-center gap-8">
          <span className="min-w-0 flex-1 truncate font-semibold text-13 text-gray-12">
            {feature.name}
          </span>
          {stats.active ? <Pill label={`${stats.active} active`} tone="primary" size="sm" /> : null}
          {stats.blocked ? (
            <Pill label={`${stats.blocked} blocked`} tone="warning" size="sm" />
          ) : null}
          {complete ? <Pill label="complete" tone="success" size="sm" /> : null}
        </span>

        <Progress
          value={stats.percent}
          tone={complete ? 'success' : stats.blocked ? 'warning' : 'primary'}
          size="sm"
          label={`${stats.done}/${stats.total}`}
          trailing={stats.spent ? duration(stats.spent) : undefined}
        />
      </button>
    </li>
  );
}

function FeatureDetail({ feature }: { feature: Feature }) {
  const stats = rollup([feature]);

  return (
    <div className="flex min-w-0 flex-col gap-16 p-20">
      <header className="flex flex-col gap-12">
        <h2 className="font-semibold text-16 text-gray-12">{feature.name}</h2>
        <Progress
          value={stats.percent}
          tone={stats.done === stats.total ? 'success' : 'primary'}
          size="lg"
          label={`${stats.done}/${stats.total}`}
          trailing={
            stats.estimated
              ? `${duration(stats.spent)} of ${duration(stats.estimated)}`
              : stats.spent
                ? duration(stats.spent)
                : undefined
          }
        />
      </header>

      {feature.description ? (
        <section className="border-gray-6 border-t pt-16">
          <Prose>{feature.description}</Prose>
        </section>
      ) : null}

      <section className="border-gray-6 border-t pt-16">
        <h3 className="mb-8 font-semibold text-10 text-gray-11 uppercase tracking-wider">
          Tasks · {feature.tasks.length}
        </h3>
        <ul className="flex flex-col gap-6">
          {[...feature.tasks].sort(byStatus).map((task, i) => (
            <TaskRow key={`${task.title}-${i}`} task={task} />
          ))}
        </ul>
      </section>
    </div>
  );
}
