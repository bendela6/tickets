import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { defineForm, Form, useForm, type FormApi } from '@tickets/form';

import { useCreateTerminalSession } from '../../api/use-create-terminal-session';
import { useCreateWorkdir } from '../../api/use-create-workdir';
import { useWorkdirs } from '../../api/use-workdirs';
import { formRegistry } from '../../form/registry';
import { Button, Combobox, DialogContent, DialogDescription, DialogFooter, DialogRoot, DialogTitle, Input, SectionHeader } from '@tickets/ui';

// The add-workdir fields, driven by @tickets/form: a mono name and the
// directory-tree widget. `command` is NOT here — it applies to both the add
// and pick flows, so it stays a plain controlled input below the form.
const workdirFormConfig = defineForm(formRegistry).build((b) => [
  b.text({
    name: 'name',
    label: 'Workdir name',
    required: true,
    config: { placeholder: 'tickets', mono: true },
  }),
  b.directory({ name: 'path', label: 'Path', required: true, config: {} }),
]);

// Last path segment, tolerant of both separators and a trailing slash.
function basename(p: string): string {
  const parts = p.split(/[/\\]/).filter(Boolean);
  return parts.at(-1) ?? p;
}

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <SectionHeader
      title={children}
      count={hint != null ? <span className="font-400 normal-case text-gray-9">{hint}</span> : null}
      className="mb-6 gap-6 tracking-wide"
    />
  );
}

// The "New terminal session" flow (screen 10, terminal variant). Picks an
// existing workdir (Combobox) or adds one inline via @tickets/form — E1 has no
// separate workdir-admin screen, so the first workdir is created here — then
// POSTs the session and hands the new id back so the caller can navigate.
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

  // Own the add-workdir form at the dialog level so we can seed `name` from a
  // picked folder and read live values for the hint / Start gate. The form is
  // rendered via `<Form formApi>` (api mode) so this single instance backs both
  // the fields and our imperative reads/writes.
  const { form, cache } = useForm({
    config: workdirFormConfig,
    defaultValues: { name: '', path: '' },
  });

  const [workdirId, setWorkdirId] = useState<string | null>(null);
  const [addingWorkdir, setAddingWorkdir] = useState(false);
  const [command, setCommand] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Seed guard: once the user edits the name themselves we stop overwriting it;
  // clearing the name re-arms seeding on the next folder pick. A seed write is
  // recognised by BOTH a `seededByEffect` flag AND the exact string we seeded
  // (`lastSeeded`) — the pair matters because a same-basename reseed calls
  // `setFieldValue` with the string already in the box, which does NOT change
  // the primitive `name` and so never fires the name-effect that would consume
  // the flag. Left flag-only, that stuck `seededByEffect` would swallow the
  // user's next genuine edit; requiring `name === lastSeeded` lets a real edit
  // (a DIFFERENT string) fall through to `nameEdited = true` regardless.
  const nameEdited = useRef(false);
  const seededByEffect = useRef(false);
  const lastSeeded = useRef<string | null>(null);

  // Subscribe to live form values (path/name) without pulling a second copy of
  // @tanstack/react-form into this app — read the form's store directly.
  const values = useSyncExternalStore(
    useCallback(
      (onChange: () => void) => {
        // @tanstack/store returns `{ unsubscribe }`, not a bare cleanup fn.
        const sub = form.store.subscribe(onChange);
        return () => sub.unsubscribe();
      },
      [form],
    ),
    () => form.store.state.values,
  ) as Record<string, unknown>;
  const path = String(values.path ?? '');
  const name = String(values.name ?? '');

  const list = workdirs.data ?? [];
  // Fall back to the inline add form when there is nothing to pick.
  const showAddForm = addingWorkdir || (workdirs.isSuccess && list.length === 0);
  const submitting = createSession.isPending || createWorkdir.isPending;

  // Name auto-seed: a fresh folder pick seeds the name from its basename until
  // the user takes it over. Runs on every path change (deps gate it), recording
  // both the flag and the exact string we wrote so the name-effect can tell our
  // own write from a user edit.
  useEffect(() => {
    if (path && !nameEdited.current) {
      const base = basename(path);
      seededByEffect.current = true;
      lastSeeded.current = base;
      form.setFieldValue('name', base);
    }
  }, [path, form]);

  // Detect a manual name edit vs. our own seed; an empty name re-arms seeding.
  // The seed-echo consume is guarded by BOTH the flag AND the string matching
  // what we last seeded — so any change to a DIFFERENT string is a user write,
  // even if the flag is stuck true from a same-basename reseed that produced no
  // primitive change (that's the scenario a flag-only check gets wrong).
  useEffect(() => {
    if (name === '') {
      nameEdited.current = false;
      seededByEffect.current = false;
      return;
    }
    if (seededByEffect.current && name === lastSeeded.current) {
      seededByEffect.current = false;
      return;
    }
    nameEdited.current = true;
  }, [name]);

  const selected = list.find((w) => String(w.id) === workdirId);
  const canSubmit = showAddForm
    ? path.trim().length > 0 && name.trim().length > 0
    : workdirId !== null;

  const hint = showAddForm
    ? !path
      ? 'pick a folder to continue'
      : !name
        ? 'name the workdir to continue'
        : `starts in ${path}`
    : !workdirId
      ? 'pick a workdir to continue'
      : selected
        ? `starts in ${selected.path}`
        : '';

  // FormApi for `<Form formApi>` — it only consumes `__internals`; the rest of
  // the shape is satisfied from live state so the type stays honest.
  const formApi: FormApi = {
    isDirty: false,
    isSubmitting: submitting,
    isValid: canSubmit,
    formError: undefined,
    submit: async () => {
      await form.handleSubmit();
    },
    reset: () => form.reset(),
    getValues: () => form.store.state.values,
    __internals: { form, cache },
  };

  function reset() {
    setWorkdirId(null);
    setAddingWorkdir(false);
    setCommand('');
    setError(null);
    nameEdited.current = false;
    seededByEffect.current = false;
    lastSeeded.current = null;
    form.reset();
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
        const wd = await createWorkdir.mutateAsync({ name: name.trim(), path: path.trim() });
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

        <div className="mt-16 flex flex-col gap-16">
          {showAddForm ? (
            <>
              <Form formApi={formApi} config={workdirFormConfig} registry={formRegistry} />
              {list.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setAddingWorkdir(false)}
                  className="self-start font-sans text-12/17 text-indigo-9 hover:underline"
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
                className="mt-6 font-sans text-12/17 text-indigo-9 hover:underline"
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
              className="font-mono text-13"
            />
          </label>

          {error ? <p className="font-sans text-12/17 text-red-9">{error}</p> : null}
        </div>

        <div className="mt-20 flex items-center justify-between gap-8">
          <span className="font-mono text-11 text-gray-9">{hint}</span>
          <DialogFooter
            className="mt-0 border-0 p-0"
            cancel={<Button variant="ghost" onClick={() => change(false)}>Cancel</Button>}
          >
            <Button variant="solid" onClick={submit} disabled={!canSubmit} loading={submitting}>
              Start session
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
