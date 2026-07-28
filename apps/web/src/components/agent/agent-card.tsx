import type { Agent, PermissionMode } from '../../api/types';
import { Avatar, cn } from '@tickets/ui';
import { avatarFor } from '../../domain/actor';

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

// The AGENT marker shown next to an agent's name — same language the assignee
// dropdown uses so a persona reads as an agent everywhere it appears as a user.
export function AgentBadge() {
  return (
    <span className="inline-flex h-4 items-center rounded-[4px] bg-indigo-3 px-1.5 font-mono text-9 font-500 text-indigo-9">
      AGENT
    </span>
  );
}

// A permission mode reads as either "runs on its own" (bypass) or "checks
// with a human" (default/acceptEdits/dontAsk) — colour it so the autonomy
// level is legible at a glance.
const MODE_LABEL: Record<PermissionMode, string> = {
  default: 'asks first',
  acceptEdits: 'auto-edits',
  bypassPermissions: 'autonomous',
  plan: 'plan only',
  dontAsk: "don't ask",
};

export function PermissionBadge({ mode }: { mode: PermissionMode }) {
  const autonomous = mode === 'bypassPermissions';
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-[5px] px-1.75 font-mono text-10',
        autonomous ? 'bg-indigo-3 text-indigo-9' : 'bg-orange-3 text-orange-9',
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
  agent: Agent;
  sessionCount: number;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-64 flex-col gap-2.5 rounded-lg border border-gray-6 bg-surface-raised p-3.5 text-left hover:border-gray-7"
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={agent.name} {...avatarFor('agent')} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-sans text-ui font-600 text-gray-12">{agent.name}</div>
          <div className="truncate font-mono text-meta text-gray-9">
            {providerLabel(agent.providerKey)} · {agent.model}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <PermissionBadge mode={agent.permissionMode} />
        <span className="inline-flex h-5 items-center rounded-[5px] border border-gray-6 px-1.75 font-mono text-10 text-gray-11">
          {agent.allowedTools.length} tools
        </span>
      </div>
      <div className="border-t border-gray-6 pt-2 font-mono text-11 text-gray-9">
        {sessionCount} session{sessionCount === 1 ? '' : 's'}
      </div>
    </button>
  );
}
