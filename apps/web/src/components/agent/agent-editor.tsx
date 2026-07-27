import { useMemo, useState, type ReactNode } from 'react';
import type { Agent, AgentProviderInfo, PermissionMode } from '../../api/types';
import { useCreateAgent } from '../../api/use-create-agent';
import { usePatchAgent } from '../../api/use-patch-agent';
import { useWorkdirs } from '../../api/use-workdirs';
import { Button, Combobox, DialogContent, DialogFooter, DialogRoot, DialogTitle, Input, SectionHeader, Textarea } from '@tickets/ui';
import { providerLabel } from './agent-card';

// The new agent.permission_mode enum carries exactly these 5 values — the old
// public enum's 6th value, `auto`, is gone (see task-8-report.md). Selecting
// it would 400 against the API's picklist.
const ALL_MODES: PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk'];
// Modes that need a mid-run pause for a human — unavailable when a provider
// can't do permissions.
const NEEDS_PERMISSIONS: PermissionMode[] = ['default', 'acceptEdits', 'dontAsk'];

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <SectionHeader
      title={children}
      count={hint != null ? <span className="font-normal normal-case text-gray-9">{hint}</span> : null}
      className="mb-1.5 gap-1.5 tracking-wide"
    />
  );
}

// Create / edit a persona. When the chosen provider can't pause for approvals or
// resume, the affected controls are DISABLED (not hidden) with an honest note,
// so the trade-off stays visible (screen 10, degraded state).
export function AgentEditor({
  open,
  onOpenChange,
  agent,
  providers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: Agent;
  providers: AgentProviderInfo[];
}) {
  const editing = agent != null;
  const workdirs = useWorkdirs();
  const create = useCreateAgent();
  const patch = usePatchAgent();

  const [name, setName] = useState(agent?.name ?? '');
  const [key, setKey] = useState(agent?.key ?? '');
  const [providerKey, setProviderKey] = useState(agent?.providerKey ?? providers[0]?.key ?? 'claude');
  const [model, setModel] = useState(agent?.model ?? '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt ?? '');
  const [tools, setTools] = useState((agent?.allowedTools ?? []).join(', '));
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(
    agent?.permissionMode ?? 'bypassPermissions',
  );
  const [workdirId, setWorkdirId] = useState<string | null>(
    agent?.defaultWorkdirId != null ? String(agent.defaultWorkdirId) : null,
  );
  const [error, setError] = useState<string | null>(null);

  const provider = providers.find((p) => p.key === providerKey);
  const caps = provider?.capabilities ?? { permissions: true, resume: true, mcp: true, subagents: true };
  const models = provider?.models ?? [];

  const modeOptions = useMemo(
    () =>
      ALL_MODES.filter((m) => caps.permissions || !NEEDS_PERMISSIONS.includes(m)).map((m) => ({
        value: m,
        label: m,
      })),
    [caps.permissions],
  );

  const saving = create.isPending || patch.isPending;
  const canSave = name.trim() && model.trim() && (editing || key.trim());

  async function save() {
    setError(null);
    const allowedTools = tools
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const workdir = workdirId != null ? Number(workdirId) : null;
    try {
      if (editing) {
        await patch.mutateAsync({
          id: agent.id,
          name: name.trim(),
          model: model.trim(),
          systemPrompt: systemPrompt.trim() || null,
          allowedTools,
          permissionMode,
          defaultWorkdirId: workdir,
        });
      } else {
        await create.mutateAsync({
          key: key.trim(),
          name: name.trim(),
          providerKey,
          model: model.trim(),
          systemPrompt: systemPrompt.trim() || undefined,
          allowedTools,
          permissionMode,
          defaultWorkdirId: workdir ?? undefined,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the agent');
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(34rem,calc(100vw-2rem))]">
        <DialogTitle>{editing ? `Edit ${agent.name}` : 'New agent'}</DialogTitle>

        <div className="mt-4 flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          {!caps.permissions || !caps.resume ? (
            <div className="rounded-lg border border-orange-9 bg-orange-3 px-3 py-2 font-sans text-meta text-gray-12">
              <strong className="font-semibold">{providerLabel(providerKey)} can’t do everything.</strong>{' '}
              {!caps.permissions ? 'It can’t pause a run for tool approvals. ' : ''}
              {!caps.resume ? 'It can’t resume after a restart. ' : ''}
              The affected controls are disabled, not hidden.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coder" />
            </label>
            <label className="block">
              <Label hint={editing ? 'fixed' : undefined}>Key</Label>
              <Input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="coder"
                disabled={editing}
                className="font-mono text-[13px]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <Label>Provider</Label>
              <Combobox
                options={providers.map((p) => ({ value: p.key, label: providerLabel(p.key) }))}
                value={providerKey}
                onChange={(v) => {
                  setProviderKey(v ?? providerKey);
                  setModel(''); // models are provider-specific
                }}
                disabled={editing}
              />
            </label>
            <label className="block">
              <Label>Model</Label>
              <Combobox
                options={models.map((m) => ({ value: m.id, label: m.label }))}
                value={model || null}
                onChange={(v) => setModel(v ?? '')}
                placeholder="Select a model…"
              />
            </label>
          </div>

          <label className="block">
            <Label hint="what the persona is for">System prompt</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a terse senior engineer…"
              rows={3}
            />
          </label>

          <label className="block">
            <Label hint="comma-separated">Tool allowlist</Label>
            <Input
              value={tools}
              onChange={(e) => setTools(e.target.value)}
              placeholder="Read, Grep, Edit, Bash"
              className="font-mono text-[13px]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <Label>Permission mode</Label>
              <Combobox
                options={modeOptions}
                value={permissionMode}
                onChange={(v) => setPermissionMode((v as PermissionMode) ?? permissionMode)}
              />
            </label>
            <label className="block">
              <Label hint="optional">Default workdir</Label>
              <Combobox
                options={(workdirs.data ?? []).map((w) => ({
                  value: String(w.id),
                  label: w.name,
                }))}
                value={workdirId}
                onChange={setWorkdirId}
                clearable
                placeholder="None"
              />
            </label>
          </div>

          {error ? <p className="font-sans text-meta text-red-9">{error}</p> : null}
        </div>

        <DialogFooter cancel={<Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>}>
          <Button variant="solid" onClick={save} disabled={!canSave} loading={saving}>
            {editing ? 'Save' : 'Create agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
