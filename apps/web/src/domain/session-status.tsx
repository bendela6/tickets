import type { ReactElement } from 'react';
import { Icon } from '@tickets/ui/icon';
import type { Tone } from '@tickets/ui/tones';
import type { SessionKind } from '../ui/session-kind-glyph';

// The app's ONE terminal/agent session status mapping — ported from the
// retired session-status pill component's PILL + TERMINAL_LABELS tables.
// Nothing else in apps/web may decide what tone/icon/label a session status
// gets — spread this into <Pill>.
export type SessionStatus =
  | 'starting'
  | 'running'
  | 'idle'
  | 'awaiting_input'
  | 'interrupted'
  | 'exited'
  | 'failed'
  | 'live'
  | 'disconnected';

type Entry = { tone: Tone; emphasis?: 'solid'; icon: ReactElement; label: string; className?: string };

// Reuses the run-status pill visual language: a coloured pill + a shape-coded
// icon, so state reads at a glance and is not carried by colour alone. The
// one state that must shout is `awaiting_input` — a solid, gently pulsing
// pill that reads as "needs you", deliberately distinct from the calm `idle`
// ring.
const MAP: Record<SessionStatus, Entry> = {
  starting: { tone: 'gray', icon: <Icon name="circle-half" size={10} animate="spin" />, label: 'starting' },
  running: { tone: 'blue', icon: <Icon name="circle-half" size={10} animate="spin" />, label: 'running' },
  idle: { tone: 'green', icon: <Icon name="circle-dot" size={10} />, label: 'idle' },
  awaiting_input: {
    tone: 'orange',
    emphasis: 'solid',
    className: 'font-semibold animate-ai-pulse',
    icon: <Icon name="diamond" size={8} />,
    label: 'awaiting input',
  },
  interrupted: { tone: 'gray', icon: <Icon name="circle-dashed" size={10} />, label: 'interrupted' },
  exited: { tone: 'secondary', icon: <Icon name="square" size={9} />, label: 'exited' },
  failed: { tone: 'danger', icon: <Icon name="circle-x" size={10} />, label: 'failed' },
  live: { tone: 'blue', icon: <Icon name="dot" size={9} />, label: 'Live' },
  disconnected: { tone: 'gray', icon: <Icon name="circle" size={10} className="opacity-70" />, label: 'Disconnected' },
};

// Terminal sessions have their own vocabulary for a subset of statuses —
// this overrides the shared MAP label when `kind="terminal"`.
const TERMINAL_LABELS: Partial<Record<SessionStatus, string>> = {
  starting: 'Connecting',
  live: 'Live',
  failed: "Couldn't start",
};

export function sessionStatus(status: SessionStatus, kind?: SessionKind): Entry {
  const entry = MAP[status];
  const label = (kind === 'terminal' && TERMINAL_LABELS[status]) || entry.label;
  return { ...entry, label };
}
