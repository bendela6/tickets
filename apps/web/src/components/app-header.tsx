import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { Board } from '../api/types';
import { useCreateProject } from '../api/use-create-project';
import { useCreateUser } from '../api/use-create-user';
import { useProjects } from '../api/use-projects';
import { useCurrentUser } from '../state/current-user-context';
import { applyTheme } from '../utils/apply-theme';

export function AppHeader({
  projectKey,
  board,
  onNewTicket,
}: {
  projectKey: string;
  board: Board;
  onNewTicket: () => void;
}) {
  const navigate = useNavigate();
  const projects = useProjects();
  const createProject = useCreateProject();
  const createUser = useCreateUser();
  const { userId, setUserId } = useCurrentUser();
  const [theme, setTheme] = useState(document.documentElement.dataset.theme ?? 'light');
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [projectDraft, setProjectDraft] = useState({ key: '', name: '', ticketPrefix: 'TASK' });
  const [userDraft, setUserDraft] = useState('');

  const selectStyle = {
    font: 'inherit',
    fontSize: 13,
    color: 'var(--ink)',
    background: 'var(--surface)',
    border: '1px solid var(--ring)',
    borderRadius: 8,
    padding: '5px 8px',
  } as const;

  return (
    <header className="top">
      <h1>{board.project.name}</h1>
      <select
        aria-label="Project"
        style={selectStyle}
        value={projectKey}
        onChange={(event) => {
          if (event.target.value === '__new__') {
            setCreatingProject(true);
            return;
          }
          void navigate({ to: '/p/$projectKey', params: { projectKey: event.target.value } });
        }}
      >
        {(projects.data?.data ?? [board.project]).map((project) => (
          <option key={project.id} value={project.key}>
            {project.key}
          </option>
        ))}
        <option value="__new__">+ new project…</option>
      </select>
      {creatingProject ? (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <input
            style={selectStyle}
            placeholder="key"
            value={projectDraft.key}
            onChange={(event) => setProjectDraft({ ...projectDraft, key: event.target.value })}
          />
          <input
            style={selectStyle}
            placeholder="name"
            value={projectDraft.name}
            onChange={(event) => setProjectDraft({ ...projectDraft, name: event.target.value })}
          />
          <input
            style={{ ...selectStyle, width: 70 }}
            placeholder="PREFIX"
            value={projectDraft.ticketPrefix}
            onChange={(event) =>
              setProjectDraft({ ...projectDraft, ticketPrefix: event.target.value.toUpperCase() })
            }
          />
          <button
            type="button"
            className="btn primary"
            disabled={!projectDraft.key || !projectDraft.name || !projectDraft.ticketPrefix}
            onClick={async () => {
              const created = await createProject.mutateAsync(projectDraft);
              setCreatingProject(false);
              void navigate({ to: '/p/$projectKey', params: { projectKey: created.key } });
            }}
          >
            Create
          </button>
          <button type="button" className="btn" onClick={() => setCreatingProject(false)}>
            ✕
          </button>
        </span>
      ) : null}
      <span className="spacer" />
      {creatingUser ? (
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <input
            style={selectStyle}
            placeholder="your name"
            value={userDraft}
            onChange={(event) => setUserDraft(event.target.value)}
          />
          <button
            type="button"
            className="btn primary"
            disabled={userDraft.trim().length === 0}
            onClick={async () => {
              const created = await createUser.mutateAsync({ name: userDraft.trim() });
              setUserId(created.id);
              setCreatingUser(false);
              setUserDraft('');
            }}
          >
            Add
          </button>
          <button type="button" className="btn" onClick={() => setCreatingUser(false)}>
            ✕
          </button>
        </span>
      ) : (
        <select
          aria-label="Acting as"
          style={selectStyle}
          value={userId ?? ''}
          onChange={(event) => {
            if (event.target.value === '__new__') {
              setCreatingUser(true);
              return;
            }
            if (event.target.value !== '') {
              setUserId(Number(event.target.value));
            }
          }}
        >
          <option value="" disabled>
            acting as…
          </option>
          {board.users
            .filter((user) => !user.archivedAt)
            .map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
                {user.kind === 'agent' ? ' 🤖' : ''}
              </option>
            ))}
          <option value="__new__">+ new user…</option>
        </select>
      )}
      <button type="button" className="btn primary" onClick={onNewTicket}>
        + New ticket
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => {
          const next = theme === 'dark' ? 'light' : 'dark';
          applyTheme(next);
          setTheme(next);
        }}
      >
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </header>
  );
}
