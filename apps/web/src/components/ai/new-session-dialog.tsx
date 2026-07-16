import { useState, type ReactNode } from 'react';
import { useAiWorkspaces } from '../../api/use-ai-workspaces';
import { useCreateAiSession } from '../../api/use-create-ai-session';
import { useCreateAiWorkspace } from '../../api/use-create-ai-workspace';
import { Button } from '../../ui/button';
import { Combobox } from '../../ui/combobox';
import { DialogContent, DialogDescription, DialogRoot, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5 font-sans text-label font-medium uppercase tracking-wide text-ink-2">
      {children}
      {hint ? <span className="font-normal normal-case text-ink-3">{hint}</span> : null}
    </span>
  );
}

// The "New terminal session" flow (screen 10, terminal variant). Picks an
// existing workspace or adds one inline — E1 has no separate workspace-admin
// screen, so the first workspace is created here — then POSTs the session and
// hands the new id back so the caller can navigate to the terminal.
export function NewSessionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (sessionId: number) => void;
}) {
  const workspaces = useAiWorkspaces();
  const createSession = useCreateAiSession();
  const createWorkspace = useCreateAiWorkspace();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [addingWorkspace, setAddingWorkspace] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsPath, setWsPath] = useState('');
  const [command, setCommand] = useState('');
  const [error, setError] = useState<string | null>(null);

  const list = workspaces.data ?? [];
  // Fall back to the inline form when there is nothing to pick.
  const showAddForm = addingWorkspace || (workspaces.isSuccess && list.length === 0);
  const submitting = createSession.isPending || createWorkspace.isPending;
  const canSubmit = showAddForm
    ? wsName.trim().length > 0 && wsPath.trim().length > 0
    : workspaceId !== null;

  function reset() {
    setWorkspaceId(null);
    setAddingWorkspace(false);
    setWsName('');
    setWsPath('');
    setCommand('');
    setError(null);
  }

  function change(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function submit() {
    setError(null);
    try {
      let id: number;
      if (showAddForm) {
        const ws = await createWorkspace.mutateAsync({ name: wsName.trim(), path: wsPath.trim() });
        id = ws.id;
      } else {
        id = Number(workspaceId);
      }
      const session = await createSession.mutateAsync({
        kind: 'terminal',
        workspaceId: id,
        command: command.trim() || undefined,
      });
      onCreated(session.id);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the session');
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={change}>
      <DialogContent>
        <DialogTitle>New terminal session</DialogTitle>
        <DialogDescription>A real PTY running in the workspace directory.</DialogDescription>

        <div className="mt-4 flex flex-col gap-4">
          {showAddForm ? (
            <>
              <label className="block">
                <Label>Workspace name</Label>
                <Input
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder="tickets"
                  autoFocus
                />
              </label>
              <label className="block">
                <Label hint="an existing directory on the server">Path</Label>
                <Input
                  value={wsPath}
                  onChange={(e) => setWsPath(e.target.value)}
                  placeholder="/home/me/work/tickets"
                  className="font-mono text-[13px]"
                />
              </label>
              {list.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setAddingWorkspace(false)}
                  className="self-start font-sans text-meta text-accent hover:underline"
                >
                  ← pick an existing workspace
                </button>
              ) : null}
            </>
          ) : (
            <label className="block">
              <Label>Workspace</Label>
              <Combobox
                options={list.map((w) => ({ value: String(w.id), label: `${w.name} · ${w.path}` }))}
                value={workspaceId}
                onChange={setWorkspaceId}
                placeholder={workspaces.isLoading ? 'Loading…' : 'Select a workspace…'}
              />
              <button
                type="button"
                onClick={() => setAddingWorkspace(true)}
                className="mt-1.5 font-sans text-meta text-accent hover:underline"
              >
                ＋ New workspace
              </button>
            </label>
          )}

          <label className="block">
            <Label hint="optional — defaults to your shell">Command</Label>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="claude"
              className="font-mono text-[13px]"
            />
          </label>

          {error ? <p className="font-sans text-meta text-danger">{error}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => change(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit} loading={submitting}>
            Start session
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
