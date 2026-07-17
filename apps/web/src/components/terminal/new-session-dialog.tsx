import { useState, type ReactNode } from 'react';
import { useCreateTerminalSession } from '../../api/use-create-terminal-session';
import { useCreateWorkdir } from '../../api/use-create-workdir';
import { useWorkdirs } from '../../api/use-workdirs';
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
// existing workdir or adds one inline — E1 has no separate workdir-admin
// screen, so the first workdir is created here — then POSTs the session and
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
  const workdirs = useWorkdirs();
  const createSession = useCreateTerminalSession();
  const createWorkdir = useCreateWorkdir();

  const [workdirId, setWorkdirId] = useState<string | null>(null);
  const [addingWorkdir, setAddingWorkdir] = useState(false);
  const [wdName, setWdName] = useState('');
  const [wdPath, setWdPath] = useState('');
  const [command, setCommand] = useState('');
  const [error, setError] = useState<string | null>(null);

  const list = workdirs.data ?? [];
  // Fall back to the inline form when there is nothing to pick.
  const showAddForm = addingWorkdir || (workdirs.isSuccess && list.length === 0);
  const submitting = createSession.isPending || createWorkdir.isPending;
  const canSubmit = showAddForm
    ? wdName.trim().length > 0 && wdPath.trim().length > 0
    : workdirId !== null;

  function reset() {
    setWorkdirId(null);
    setAddingWorkdir(false);
    setWdName('');
    setWdPath('');
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
        const wd = await createWorkdir.mutateAsync({ name: wdName.trim(), path: wdPath.trim() });
        id = wd.id;
      } else {
        id = Number(workdirId);
      }
      const session = await createSession.mutateAsync({
        workdirId: id,
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
        <DialogDescription>A real PTY running in the workdir.</DialogDescription>

        <div className="mt-4 flex flex-col gap-4">
          {showAddForm ? (
            <>
              <label className="block">
                <Label>Workdir name</Label>
                <Input
                  value={wdName}
                  onChange={(e) => setWdName(e.target.value)}
                  placeholder="tickets"
                  autoFocus
                />
              </label>
              <label className="block">
                <Label hint="an existing directory on the server">Path</Label>
                <Input
                  value={wdPath}
                  onChange={(e) => setWdPath(e.target.value)}
                  placeholder="/home/me/work/tickets"
                  className="font-mono text-[13px]"
                />
              </label>
              {list.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setAddingWorkdir(false)}
                  className="self-start font-sans text-meta text-accent hover:underline"
                >
                  ← pick an existing workdir
                </button>
              ) : null}
            </>
          ) : (
            <label className="block">
              <Label>Workdir</Label>
              <Combobox
                options={list.map((w) => ({ value: String(w.id), label: `${w.name} · ${w.path}` }))}
                value={workdirId}
                onChange={setWorkdirId}
                placeholder={workdirs.isLoading ? 'Loading…' : 'Select a workdir…'}
              />
              <button
                type="button"
                onClick={() => setAddingWorkdir(true)}
                className="mt-1.5 font-sans text-meta text-accent hover:underline"
              >
                ＋ New workdir
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
