import type { AiAgent, PermissionMode } from '../../api/types';
import { Avatar } from '../../ui/avatar';
import { cn } from '../../ui/cn';

const PROVIDER_LABEL: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
  grok: 'Grok',
  ollama: 'Local',
};

export function providerLabel(key: string): string {
  return PROVIDER_LABEL[key] ?? key;
}

// A permission mode reads as either "runs on its own" (bypass/auto) or "checks
// with a human" (default/acceptEdits/dontAsk) — colour it so the autonomy level
// is legible at a glance.
const MODE_LABEL: Record<PermissionMode, string> = {
  default: 'asks first',
  acceptEdits: 'auto-edits',
  bypassPermissions: 'autonomous',
  plan: 'plan only',
  dontAsk: "don't ask",
  auto: 'auto-approve',
};

export function PermissionBadge({ mode }: { mode: PermissionMode }) {
  const autonomous = mode === 'bypassPermissions' || mode === 'auto';
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-[5px] px-1.75 font-mono text-[10px]',
        autonomous ? 'bg-accent-subtle text-accent' : 'bg-kind-blocked-subtle text-kind-blocked',
      )}
    >
      {MODE_LABEL[mode]}
    </span>
  );
}

export function AgentCard({
  agent,
  sessionCount,
  onEdit,
}: {
  agent: AiAgent;
  sessionCount: number;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-64 flex-col gap-2.5 rounded-card border border-hairline bg-raised p-3.5 text-left hover:border-control"
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={agent.name} kind="agent" size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-sans text-ui font-semibold text-ink">{agent.name}</div>
          <div className="truncate font-mono text-meta text-ink-3">
            {providerLabel(agent.providerKey)} · {agent.model}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <PermissionBadge mode={agent.permissionMode} />
        <span className="inline-flex h-5 items-center rounded-[5px] border border-hairline px-1.75 font-mono text-[10px] text-ink-2">
          {agent.allowedTools.length} tools
        </span>
      </div>
      <div className="border-t border-hairline pt-2 font-mono text-[11px] text-ink-3">
        {sessionCount} session{sessionCount === 1 ? '' : 's'}
      </div>
    </button>
  );
}
