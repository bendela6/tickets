import { Link } from '@tanstack/react-router';
import { Input, Pill, ScreenState, StatusDot } from '@tickets/ui';
import { useState } from 'react';
import type { BoardState, SessionSummary } from '../../shared/types';
import { relative } from '../api';

// Sessions are chosen from a project dropdown plus a title filter — one way to narrow
// the list, not two competing ones. A worktree session belongs to its parent
// repository, so it is tagged on its row rather than given a group of its own.

function matches(session: SessionSummary, project: string, filter: string): boolean {
  if (project && session.project !== project) return false;
  if (!filter) return true;
  const haystack = `${session.title ?? ''} ${session.project} ${session.worktree ?? ''}`;
  return haystack.toLowerCase().includes(filter.toLowerCase());
}

export function SessionNav({ board, activeId }: { board: BoardState; activeId?: string }) {
  const [project, setProject] = useState('');
  const [filter, setFilter] = useState('');

  const visible = board.sessions.filter((s) => matches(s, project, filter));
  const total = board.projects.reduce((n, p) => n + p.count, 0);

  return (
    <nav className="flex min-h-0 flex-col border-gray-6 border-r bg-surface-inset">
      <div className="flex flex-col gap-8 border-gray-6 border-b p-12">
        {/* The library has no Select; a native one carries the token styling fine
            and keeps keyboard behaviour for free. */}
        <select
          aria-label="Project"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="w-full rounded-md border border-gray-6 bg-surface-raised px-8 py-6 text-12/17 text-gray-12"
        >
          <option value="">{`All projects · ${total}`}</option>
          {board.projects.map((p) => (
            <option key={p.name} value={p.name}>
              {`${p.name} · ${p.count}${p.open ? ` · ${p.open} open` : ''}`}
            </option>
          ))}
        </select>
        <Input
          aria-label="Filter sessions by title"
          placeholder="Filter by title…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-8">
        {visible.length === 0 ? (
          <ScreenState title="No sessions match" icon="search" />
        ) : (
          visible.map((s) => <NavRow key={s.id} session={s} active={s.id === activeId} />)
        )}
      </div>
    </nav>
  );
}

function NavRow({ session, active }: { session: SessionSummary; active: boolean }) {
  const { tasks } = session;
  return (
    <Link
      to="/session/$id/$tab"
      params={{ id: session.id, tab: 'features' }}
      className={[
        'mb-2 block rounded-md border px-10 py-8 no-underline',
        active ? 'border-indigo-8 bg-surface-raised' : 'border-transparent hover:bg-surface-raised',
      ].join(' ')}
    >
      <span className="mb-4 flex items-center gap-8">
        <StatusDot state={session.live ? 'active' : 'resting'}
        label={session.live ? 'live' : 'idle'} />
        <span className="min-w-0 truncate font-semibold text-13 text-gray-12">
          {session.title ?? session.project}
        </span>
      </span>
      {/* Indented to the title text rather than the dot: 8px dot + 8px gap. */}
      <span className="flex items-center gap-8 pl-16 text-11 text-gray-11">
        {session.worktree ? <Pill label={session.worktree} tone="primary" size="sm" /> : null}
        <span>{session.tracked ? `${tasks.done}/${tasks.total} tasks` : 'no tasks'}</span>
        {tasks.blocked > 0 ? <span className="text-orange-11">{tasks.blocked} blocked</span> : null}
        <span className="ml-auto whitespace-nowrap">{relative(session.at)}</span>
      </span>
    </Link>
  );
}
