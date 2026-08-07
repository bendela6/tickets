import { Pill, ScreenState, SectionHeader } from '@tickets/ui';
import type { Activity, GitState, Prompt } from '../../shared/types';
import { relative } from '../api';

// Prompts, git and activity: three read-only views that share the same list vocabulary,
// so they live together rather than in three near-identical files.

export function PromptsPanel({ prompts }: { prompts: Prompt[] }) {
  if (prompts.length === 0) return <ScreenState title="No prompts recorded" />;
  return (
    <ul className="flex flex-col gap-6">
      {prompts.map((p, i) => (
        <li
          key={`${p.at ?? i}-${i}`}
          className="min-w-0 rounded-6 border border-gray-6 bg-surface-raised px-12 py-8"
        >
          <p className="whitespace-pre-wrap text-13/19 text-gray-12">{p.text}</p>
          <p className="mt-4 text-11 text-gray-11">{relative(p.at)}</p>
        </li>
      ))}
    </ul>
  );
}

export function GitPanel({ git }: { git: GitState | null }) {
  if (!git) return <ScreenState title="Not a git repository" />;
  const clean = !git.ahead && !git.modified && !git.untracked;

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-wrap gap-6">
        <Pill label={git.branch} tone="primary" />
        {git.ahead ? <Pill label={`${git.ahead} unpushed`} tone="warning" /> : null}
        {git.modified ? <Pill label={`${git.modified} modified`} tone="neutral" /> : null}
        {git.untracked ? <Pill label={`${git.untracked} untracked`} tone="neutral" /> : null}
        {clean ? <Pill label="clean" tone="success" /> : null}
      </div>

      {git.files.length > 0 ? (
        <section>
          <SectionHeader as="h2" title="Working tree" count={git.files.length} />
          <ul className="flex flex-col gap-2">
            {git.files.map((f) => (
              <li key={f.path} className="flex min-w-0 items-center gap-8 px-4 py-4">
                <span className="w-24 shrink-0 font-mono font-semibold text-11 text-orange-11">
                  {f.code}
                </span>
                <span className="min-w-0 truncate font-mono text-12 text-gray-11">{f.path}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {git.commits.length > 0 ? (
        <section>
          <SectionHeader as="h2" title="Recent commits" />
          <ul className="flex flex-col gap-2">
            {git.commits.map((c) => (
              <li key={c.sha} className="flex min-w-0 items-center gap-8 px-4 py-4">
                <span className="shrink-0 font-mono text-12 text-indigo-11">{c.sha}</span>
                <span className="min-w-0 flex-1 truncate text-12/17 text-gray-12">{c.subject}</span>
                <span className="shrink-0 text-11 text-gray-11">{c.when}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const NUM = new Intl.NumberFormat('en-US');

export function ActivityPanel({ activity }: { activity: Activity | null }) {
  if (!activity) return <ScreenState title="No activity detail for this session" />;

  const { tokens, tools, files, subagents, hooks, skills, queue } = activity;
  const toolMax = Math.max(1, ...tools.map(([, n]) => n));
  const outside = files.filter((f) => !f.inRepo).length;

  return (
    <div className="flex flex-col gap-24">
      <section>
        <SectionHeader as="h2" title="Tokens" action={activity.effort ? `effort ${activity.effort}` : undefined} />
        <div className="flex flex-wrap gap-6">
          <Pill label={`output ${NUM.format(tokens.output)}`} tone="primary" size="sm" />
          <Pill label={`input ${NUM.format(tokens.input)}`} tone="neutral" size="sm" />
          <Pill label={`cache read ${NUM.format(tokens.cacheRead)}`} tone="neutral" size="sm" />
          <Pill label={`cache write ${NUM.format(tokens.cacheWrite)}`} tone="neutral" size="sm" />
        </div>
      </section>

      {tools.length > 0 ? (
        <section>
          <SectionHeader as="h2" title="Tool calls" count={tools.reduce((n, [, c]) => n + c, 0)} />
          <ul className="flex flex-col gap-4">
            {tools.map(([name, count]) => (
              <li key={name} className="flex items-center gap-8">
                <span className="w-128 shrink-0 truncate text-12 text-gray-12">{name}</span>
                <span className="h-6 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-inset">
                  <span
                    className="block h-full rounded-full bg-indigo-9"
                    style={{ width: `${(count / toolMax) * 100}%` }}
                  />
                </span>
                <span className="w-32 shrink-0 text-right font-mono text-11 text-gray-11 tabular-nums">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {files.length > 0 ? (
        <section>
          <SectionHeader
            as="h2"
            title="Files touched"
            count={files.length}
            action={outside ? `${outside} outside this repository` : undefined}
          />
          <ul className="flex flex-col gap-2">
            {files.map((f) => (
              <li key={f.path} className="flex min-w-0 items-center gap-8 px-4 py-4">
                <Pill label={f.inRepo ? 'in' : 'out'} tone={f.inRepo ? 'success' : 'warning'} size="sm" />
                <span className="min-w-0 truncate font-mono text-12 text-gray-11">{f.path}</span>
                <span className="ml-auto shrink-0 text-11 text-gray-11">{relative(f.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {subagents.length > 0 ? (
        <section>
          <SectionHeader as="h2" title="Subagents" count={subagents.length} />
          <ul className="flex flex-col gap-4">
            {subagents.map((a) => (
              <li
                key={a.id}
                className="min-w-0 rounded-6 border border-gray-6 bg-surface-raised px-12 py-8"
              >
                <p className="text-12/17 text-gray-12">{a.task || 'no task recorded'}</p>
                <p className="mt-2 text-11 text-gray-11">
                  {a.entries} entries · {relative(a.at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {skills.length > 0 ? (
        <section>
          <SectionHeader as="h2" title="Skills used" count={skills.length} />
          <div className="flex flex-wrap gap-6">
            {skills.map((s) => (
              <Pill key={s} label={s} tone="neutral" size="sm" />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader as="h2" title="Conversation" />
        <div className="flex flex-wrap gap-6">
          <Pill label={`${queue.enqueued} queued`} tone="neutral" size="sm" />
          <Pill label={`${queue.dequeued} ran`} tone="neutral" size="sm" />
          {queue.cancelled ? (
            <Pill label={`${queue.cancelled} cancelled`} tone="warning" size="sm" />
          ) : null}
          {hooks.length ? (
            <Pill label={`${hooks.length} hook firings`} tone="neutral" size="sm" />
          ) : null}
        </div>
      </section>
    </div>
  );
}
