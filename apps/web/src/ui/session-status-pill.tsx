import { cn } from './cn';

export type SessionStatus =
  | 'starting'
  | 'running'
  | 'idle'
  | 'awaiting_input'
  | 'interrupted'
  | 'exited'
  | 'failed';

// Reuses the run-status pill visual language: a coloured pill + a shape-coded
// dot, so state reads at a glance and is not carried by colour alone. The one
// state that must shout is `awaiting_input` — a solid, gently pulsing pill that
// reads as "needs you", deliberately distinct from the calm `idle` ring.
const PILL: Record<SessionStatus, { className: string; label: string }> = {
  starting: { className: 'bg-kind-todo-subtle text-kind-todo', label: 'starting' },
  running: { className: 'bg-kind-active-subtle text-kind-active', label: 'running' },
  idle: { className: 'bg-kind-done-subtle text-kind-done', label: 'idle' },
  awaiting_input: {
    className: 'bg-kind-blocked text-on-kind-blocked font-semibold animate-ai-pulse',
    label: 'awaiting input',
  },
  interrupted: { className: 'bg-kind-dropped-subtle text-kind-dropped', label: 'interrupted' },
  exited: { className: 'bg-inset text-ink-2', label: 'exited' },
  failed: { className: 'bg-danger-subtle text-danger', label: 'failed' },
};

function StatusDot({ status }: { status: SessionStatus }) {
  switch (status) {
    // In-flight work: a spinning half-disc in the current (pill) colour.
    case 'starting':
    case 'running':
      return (
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full border-[1.5px] border-current animate-ai-spin"
          style={{ background: 'linear-gradient(90deg, currentColor 50%, transparent 50%)' }}
        />
      );
    // Calm, done-coloured ring with a centre dot — parked, not in-flight.
    case 'idle':
      return (
        <span
          aria-hidden
          className="flex size-2.5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-current"
        >
          <span className="size-1 rounded-full bg-current" />
        </span>
      );
    // "Needs you" — a filled diamond on the solid pill.
    case 'awaiting_input':
      return <span aria-hidden className="size-1.75 shrink-0 rotate-45 rounded-[1px] bg-current" />;
    // Resumable break in the stream — a dashed ring.
    case 'interrupted':
      return (
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full border-[1.5px] border-dashed border-current"
        />
      );
    // Finished — a hollow square (the exit code carries success/failure).
    case 'exited':
      return (
        <span aria-hidden className="size-2 shrink-0 rounded-[2px] border-[1.5px] border-current" />
      );
    // Hard failure — a filled danger square with a cross.
    case 'failed':
      return (
        <span aria-hidden className="text-[10px] font-bold leading-none">
          ✕
        </span>
      );
  }
}

export function SessionStatusPill({
  status,
  exitCode,
  className,
}: {
  status: SessionStatus;
  exitCode?: number | null;
  className?: string;
}) {
  const pill = PILL[status];
  return (
    <span
      className={cn(
        'inline-flex h-5.5 items-center gap-1.5 rounded-md px-2.25 font-sans text-meta font-medium',
        pill.className,
        className,
      )}
    >
      <StatusDot status={status} />
      {pill.label}
      {status === 'exited' && exitCode != null ? (
        <span className={cn('font-mono', exitCode === 0 ? 'text-kind-done' : 'text-danger')}>
          {exitCode}
        </span>
      ) : null}
    </span>
  );
}
